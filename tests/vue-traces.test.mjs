// === DEBUT_TEST_VUE_TRACES ===
// PRIMITIVE PURE DE RÉEXAMEN DES TRACES (décision ChatGPT « PRIMITIVE PURE DE RÉEXAMEN DES TRACES »,
// 03/10/2026, suite au diagnostic « CONTRAT DU RÉEXAMEN DESCRIPTIF DES TRACES »). Ces tests figent le
// contrat exact défini par ce diagnostic : corpus exploitable, vue canonique, égalité de forme,
// reconstruction avant/après par id. AUCUN branchement testé ici (voir vecu-orchestration-traces.test.mjs
// et vecu.test.mjs, qui restent les seuls garants du branchement réel 'trace' -> apresNouveauVecu,
// inchangé par ce chantier).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceExploitable, vueDescriptive, reexaminerTraces } from '../app/langage/vue-traces.js';

function traceAction(id, texteBrut, extra = {}) {
  return {
    id, voie: 'action', capacite: 'quelque-capacite', resultat: { peuImporte: true },
    argumentsUtilises: {}, contexte: { texteBrut, tokens: [] }, ...extra,
  };
}
function traceComposition(id, extra = {}) {
  return {
    id, voie: 'composition', capacite: 'quelque-capacite', resultat: { peuImporte: true },
    argumentsUtilises: {}, contexte: null, ...extra,
  };
}
// Projection CANONIQUE d'une vue pour les comparaisons insensibles à l'ordre du tableau en entrée :
// {couverture, forme} par élément, triés -- jamais le "rapport" brut de decrireStructure(), dont
// l'ordre interne des valeurs (valeursDistinctes) reflète fidèlement l'ordre de PREMIÈRE RENCONTRE
// dans le corpus reçu (caractéristique déjà existante, antérieure à ce chantier, de decrireStructure()
// lui-même -- jamais une non-déterminisme introduit ici). Seule l'ÉGALITÉ de forme (section 6/9 du
// diagnostic) est garantie indépendante de l'ordre, jamais le contenu brut détaillé.
function projectionCanonique(vue) {
  return vue
    .map((e) => ({ couverture: e.couverture.slice().sort(), forme: e.forme }))
    .sort((a, b) => a.couverture.join(',').localeCompare(b.couverture.join(',')));
}
function traceAncienneSansContexte(id, extra = {}) {
  // Simule une trace v0.46.1 (avant le chantier CONTEXTE PRÉ-CHOIX) : le champ `contexte` n'existe
  // simplement pas -- absence d'information, jamais recalculée après coup.
  const t = { id, voie: 'action', capacite: 'quelque-capacite', resultat: {}, argumentsUtilises: {}, ...extra };
  delete t.contexte;
  return t;
}

// --- LE CORPUS RÉEL DU DIAGNOSTIC, t1..t8 -------------------------------------------------------
const t1 = traceAction('t1', 'zaccede zorbo zordre zkelmi');
const t2 = traceAction('t2', 'zaccede zalpha zordre zbeta');
const t3 = traceAction('t3', 'zaccede zuno zordre zdos');
const t4 = traceAction('t4', 'zaccede zfoo zautre zbar');
const t5 = traceAction('t5', 'zaccede zorbo zordre zkelmi'); // répétition exacte de t1
const t6 = traceAction('t6', 'cherche zcouleur zbleu');
const t7 = traceAction('t7', 'cherche zforme zvert');
const t8 = traceAction('t8', 'zaccede zorbo zordre zkelmi'); // 2e répétition supplémentaire (fréquence seule)

test('traceExploitable() : voie action + contexte.texteBrut chaîne -> exploitable', () => {
  assert.equal(traceExploitable(t1), true);
});
test('traceExploitable() : voie composition (contexte=null) -> jamais exploitable', () => {
  assert.equal(traceExploitable(traceComposition('c1')), false);
});
test('traceExploitable() : ancienne trace sans champ contexte -> jamais exploitable', () => {
  assert.equal(traceExploitable(traceAncienneSansContexte('anc1')), false);
});
test('traceExploitable() : voie action mais contexte.texteBrut absent/non-chaîne -> jamais exploitable', () => {
  assert.equal(traceExploitable(traceAction('x', undefined)), false);
  assert.equal(traceExploitable({ id: 'y', voie: 'action', contexte: { texteBrut: 42 } }), false);
});

test('vueDescriptive() : corpus vide -> aucun élément', () => {
  assert.deepEqual(vueDescriptive([]), []);
});
test('vueDescriptive() : une seule trace exploitable -> aucun élément (seuilMin non atteint)', () => {
  assert.deepEqual(vueDescriptive([t1]), []);
});
test('vueDescriptive() : traces composition totalement ignorées, même nombreuses', () => {
  const corpus = [t1, t2, traceComposition('c1'), traceComposition('c2'), traceComposition('c3')];
  const vueAvecCompositions = vueDescriptive(corpus);
  const vueSansCompositions = vueDescriptive([t1, t2]);
  assert.deepEqual(vueAvecCompositions, vueSansCompositions);
});
test('vueDescriptive() : ancienne trace sans contexte ignorée', () => {
  const corpus = [t1, t2, traceAncienneSansContexte('anc1'), traceAncienneSansContexte('anc2')];
  assert.deepEqual(vueDescriptive(corpus), vueDescriptive([t1, t2]));
});
test('vueDescriptive() : ordre des traces dans le tableau n\'altère pas la vue (couverture+forme)', () => {
  const corpus = [t1, t2, t3, t4, t5, t6, t7];
  const inverse = [...corpus].reverse();
  const melange = [t4, t1, t6, t3, t7, t2, t5];
  const vueOriginale = projectionCanonique(vueDescriptive(corpus));
  assert.deepEqual(projectionCanonique(vueDescriptive(inverse)), vueOriginale);
  assert.deepEqual(projectionCanonique(vueDescriptive(melange)), vueOriginale);
});
test('vueDescriptive() : plusieurs motifs redondants (même couverture exacte) sont condensés en un seul élément', () => {
  // t1+t2 partagent à la fois "zaccede" et "zordre" -- deux motifs de départ, UNE seule couverture.
  const vue = vueDescriptive([t1, t2]);
  assert.equal(vue.length, 1);
  assert.deepEqual(vue[0].couverture, ['t1', 't2']);
});
test('vueDescriptive() : aucune dépendance à capacite/resultat/argumentsUtilises (ignorés même très différents)', () => {
  const t1Alt = traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'AUTRE_CAPACITE', resultat: { tout: 'autre chose' }, argumentsUtilises: { x: 1, y: 2 } });
  const t2Alt = traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'ENCORE_UNE_AUTRE', resultat: null, argumentsUtilises: undefined });
  assert.deepEqual(vueDescriptive([t1Alt, t2Alt]), vueDescriptive([t1, t2]));
});
test('vueDescriptive() : motif groupant des textes d\'arité incompatible -> exclu silencieusement (jamais une erreur)', () => {
  // Contre-exemple trouvé pendant la tentative de réfutation (section 14 du diagnostic) : un motif
  // n=1 position-agnostique peut couvrir des textes de longueurs différentes ; decrireStructure()
  // renvoie alors {ok:false, raison:'arites_incompatibles'} -- cet élément doit être absent de la
  // vue, jamais remonté comme un crash ni comme un élément à moitié renseigné.
  const a = traceAction('a', 'zaccede zorbo zordre zkelmi');
  const b = traceAction('b', 'zaccede zalpha');
  assert.deepEqual(vueDescriptive([a, b]), []);
});

test('vueDescriptive() : seuilMin/nMax = valeurs par défaut réelles de repererMotifs() (aucun doublon de constante)', () => {
  // repererMotifs() par défaut (induction.js) vaut déjà seuilMin=2, nMax=4 -- vueDescriptive() ne doit
  // pas redéfinir de constante concurrente : l'appeler SANS options doit produire EXACTEMENT le même
  // résultat qu'en passant {seuilMin:2, nMax:4} explicitement.
  const corpus = [t1, t2, t3, t4, t5, t6, t7];
  assert.deepEqual(vueDescriptive(corpus), vueDescriptive(corpus, { seuilMin: 2, nMax: 4 }));
});

// --- DÉDOUBLONNAGE PAR COUVERTURE, JAMAIS PAR FORME SEULE (tentative de réfutation, section 14) --
test('deux éléments de couverture différente ne sont jamais fusionnés, même si la répétition en fait apparaître un second', () => {
  // Tentative de réfutation (section 14) : la canonisation initiale du diagnostic proposait de
  // dédoublonner directement par signature de FORME (« la forme découle de la couverture, une seule
  // clé suffit »). Vérifié ici : cette implication n'est vraie QUE dans un sens (couverture identique
  // => forme identique, jamais l'inverse garanti). La répétition exacte de t1 (= t5) en est la preuve
  // concrète : elle élargit la couverture du groupe "zaccede...zordre" (t1,t2 -> t1,t2,t5) ET fait
  // simultanément apparaître un second élément, entièrement distinct, à couverture plus étroite
  // (t1,t5 seuls, désormais ancrés sur les 4 positions). Les deux doivent coexister SANS être
  // fusionnés par accident -- jamais perdre l'un des deux pour l'autre.
  const vueAvant = vueDescriptive([t1, t2]);
  assert.equal(vueAvant.length, 1);
  assert.deepEqual(vueAvant[0].couverture, ['t1', 't2']);
  const vueApres = vueDescriptive([t1, t2, t5]);
  assert.equal(vueApres.length, 2);
  const couvertures = vueApres.map((e) => e.couverture.join(',')).sort();
  assert.deepEqual(couvertures, ['t1,t2,t5', 't1,t5']);
  // Les deux éléments ont des FORMES différentes (4 ancres pour l'un, 2 pour l'autre) : la
  // construction n'a donc pas pu, en pratique, produire sur ce corpus une collision RÉELLE de forme
  // entre deux couvertures distinctes -- le dédoublonnage par couverture exacte (plutôt que par
  // forme) reste néanmoins le choix retenu, car plus sûr et sans coût, sans dépendre de la preuve
  // (plus difficile) qu'une telle collision est structurellement impossible pour tout corpus.
  const formes = new Set(vueApres.map((e) => e.forme));
  assert.equal(formes.size, 2);
});

// --- RÉSULTATS t1 -> t8 (tableau K du diagnostic, figé ici comme attentes) ----------------------
const attentes = [
  { id: 't1', modifie: false },
  { id: 't2', modifie: true },
  { id: 't3', modifie: true },
  { id: 't4', modifie: true },
  { id: 't5', modifie: true },
  { id: 't6', modifie: false },
  { id: 't7', modifie: true },
  { id: 't8', modifie: false },
];
test('reexaminerTraces() : résultats t1 -> t8 conformes au tableau K du diagnostic', () => {
  const toutes = [t1, t2, t3, t4, t5, t6, t7, t8];
  let corpusActuel = [];
  for (const attendu of attentes) {
    const nouvelle = toutes.find((t) => t.id === attendu.id);
    corpusActuel = [...corpusActuel, nouvelle];
    const resultat = reexaminerTraces(corpusActuel, nouvelle.id);
    assert.equal(resultat.modifie, attendu.modifie, `trace ${attendu.id} : modifie attendu=${attendu.modifie}, obtenu=${resultat.modifie}`);
  }
});
test('reexaminerTraces() : t2 produit bien 1 élément dans la vue après (nombre attendu)', () => {
  const resultat = reexaminerTraces([t1, t2], 't2');
  assert.equal(resultat.apres.length, 1);
});
test('reexaminerTraces() : t6 laisse la vue à 3 éléments avant ET après (égalité vraie)', () => {
  const resultat = reexaminerTraces([t1, t2, t3, t4, t5, t6], 't6');
  assert.equal(resultat.modifie, false);
  assert.equal(resultat.apres.length, 3);
});

test('reexaminerTraces() : retour minimal -- seulement {modifie, apres}, jamais "avant" ni un delta', () => {
  const resultat = reexaminerTraces([t1, t2], 't2');
  assert.deepEqual(Object.keys(resultat).sort(), ['apres', 'modifie']);
});

// --- ROBUSTESSE --------------------------------------------------------------------------------
test('reexaminerTraces() : id de nouvelle trace absent du corpus -> rejeté explicitement (erreur de programmation)', () => {
  // Choix retenu (voir rapport) : idNouvelleTrace est censé être l'id d'un élément qui vient d'être
  // réellement persisté par l'appelant (même contrat que apresNouveauVecu()) -- un id qui ne
  // correspond à AUCUNE trace du tableau reçu est une erreur de programmation à signaler tout de
  // suite, jamais absorbée en silence (même principe que apresNouveauVecu() rejetant un type inconnu,
  // vecu.js, et que enregistrerJugement() rejetant un jugement hors de {correct,incorrect}).
  assert.throws(
    () => reexaminerTraces([t1, t2], 'id-totalement-inconnu'),
    /« id-totalement-inconnu » ne correspond à aucune trace/,
  );
});
test('reexaminerTraces() : aucune dépendance à "capacite"/"resultat" -- deux corpus ne différant que par ces champs donnent le même résultat', () => {
  const t1Alt = traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'X', resultat: { n: 1 } });
  const t2Alt = traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'Y', resultat: { n: 2 } });
  const r1 = reexaminerTraces([t1, t2], 't2');
  const r2 = reexaminerTraces([t1Alt, t2Alt], 't2');
  assert.equal(r1.modifie, r2.modifie);
  assert.deepEqual(projectionCanonique(r1.apres), projectionCanonique(r2.apres));
});
test('reexaminerTraces() : ordre accidentel des traces dans le tableau ne change pas "modifie"', () => {
  const corpus = [t1, t2, t3, t4, t5, t6, t7];
  const melange = [t4, t7, t1, t6, t2, t5, t3];
  const r1 = reexaminerTraces(corpus, 't7');
  const r2 = reexaminerTraces(melange, 't7');
  assert.equal(r1.modifie, r2.modifie);
  assert.deepEqual(projectionCanonique(r1.apres), projectionCanonique(r2.apres));
});
// === FIN_TEST_VUE_TRACES ===
