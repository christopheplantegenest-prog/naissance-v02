// === DEBUT_TEST_PREUVE_RELATIONNELLE_VERIFIEE ===
// v0.63.63 — VÉRIFIER LA PREUVE DU CONTRAT RELATIONNEL (décision ChatGPT, 06/10/2026). resoudreContexteObservation d'une observation 9 clés recalcule
// empreinteRelations(sous-catalogue historique) (source unique, v0.63.61) et la compare (catégorie + empreinte) à empreintesContratsRelationnels, APRÈS les preuves
// d'opérations et de catégorie, AVANT la reconstruction de l'univers et le recalcul des possibilités. Écart = TypeError, sans repli. 6/7/8 clés inchangées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { empreinteRelations } from '../app/langage/empreinte-relations.js';
import { empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const D = DESCRIPTIONS_OPERATIONS;
const H = (c) => c.repeat(64);
const clone = (x) => JSON.parse(JSON.stringify(x));
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
async function vie(messages) {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`; const tours = [];
  for (const texte of messages) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }));
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    tours.push({ S: suivi.joindre(res).sollicitation });
  }
  const l = { observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') };
  return { magasin, tours, l };
}
let VIE; const vecue = async () => (VIE ??= await vie(SCENARIO));
const ctx = (l, id, descriptions = D, lignes = l.observations) => resoudreContexteObservation(id, lignes, l.valeurs, l.executions, descriptions);
const modifier = (f) => D.map((d) => { const c = structuredClone(d); f(c); return c; });
const PREUVE = (e) => [{ categorie: 'contrats-relationnels', empreinte: e }];

// ------------------------------------------------------------------------------------------------------------------------ A. ACCEPTATION / REFUS DE LA PREUVE
test('A1. 9 clés + bon hash : acceptée ; reconstruction EXACTEMENT celle de .62 (même référence d\'observation, mêmes identités d\'univers) pour chacune des 7 observations', async () => {
  const { l } = await vecue();
  for (const o of l.observations) {
    assert.equal(Object.keys(o).length, 9);
    assert.equal(o.empreintesContratsRelationnels[0].empreinte, empreinteRelations(D));
    const r = ctx(l, o.id);
    assert.equal(r.observation, o);
    assert.deepEqual(r.univers.map((e) => e.donnee.identite), o.donneesExaminees);
  }
});
test('A2. TEST CENTRAL INVERSÉ (.62 → .63) : 9 clés + FAUX hash hex64 → REFUS (TypeError) ; catégorie correcte mais empreinte autre, quelle que soit la forme du faux', async () => {
  const { l } = await vecue();
  const O = l.observations[l.observations.length - 1];
  for (const faux of [H('f'), H('0'), empreinteRelations(D).replace(/.$/, (c) => (c === '0' ? '1' : '0')), empreinteRelations(D.filter((d) => d.nom !== "couvrirSequence"))]) {
    const o = { ...clone(O), id: 'o-faux', empreintesContratsRelationnels: PREUVE(faux) };
    assert.throws(() => ctx(l, 'o-faux', D, [...l.observations, o]), (e) => e instanceof TypeError && /contrat relationnel/.test(e.message));
  }
});
test('A3. DÉRIVES RELATIONNELLES : suppression, ajout, changement de nom, de rôle, d\'entrée associée → REFUS sous le catalogue dérivé (observation intacte, catalogue d\'origine toujours accepté)', async () => {
  const { l } = await vecue();
  const O = l.observations[l.observations.length - 1];
  const derives = {
    'suppression d\'une relation': modifier((c) => { if (c.nom === 'resoudreElements') delete c.relations; }),
    'suppression de toutes les relations': D.map(({ relations, ...d }) => d),
    'ajout sur une opération sans relation': modifier((c) => { if (c.nom === 'memesCouvertures') c.relations = [{ relation: 'couvertureDansChemins', couverture: 'a', collection: 'b' }]; }),
    'ajout d\'une seconde relation': modifier((c) => { if (c.nom === 'couvrirSequence') c.relations.push({ relation: 'plagesDansSequence', plages: 'elements', sequence: 'plages' }); }),
    'changement du NOM de relation': modifier((c) => { if (c.nom === 'resoudreElements') c.relations = [{ relation: 'plagesDansSequence', plages: 'couverture', sequence: 'elements' }]; }),
    'changement de RÔLE (couverture <-> collection échangés)': modifier((c) => { if (c.nom === 'resoudreElements') c.relations = [{ relation: 'couvertureDansChemins', couverture: 'elements', collection: 'couverture' }]; }),
    'changement d\'ENTRÉE associée': modifier((c) => { if (c.nom === 'couvrirSequence') c.relations = [{ relation: 'plagesDansSequence', plages: 'elements', sequence: 'plages' }]; }),
  };
  for (const [nom, derive] of Object.entries(derives)) {
    assert.notEqual(empreinteRelations(derive), empreinteRelations(D), nom);
    assert.throws(() => ctx(l, O.id, derive), (e) => e instanceof TypeError && /contrat relationnel/.test(e.message), nom);
  }
  assert.doesNotThrow(() => ctx(l, O.id, D));
});
test('A4. DÉRIVE NEUTRE EN APPARENCE (raison d\'être de la preuve séparée) : les atomes ET les empreintes de contrat d\'opérations sont IDENTIQUES, la reconstruction refuse quand même', async () => {
  const { l, tours } = await vecue();
  const O = l.observations[2];
  const derive = modifier((c) => { if (c.nom === 'resoudreElements') delete c.relations; });
  const univers = ctx(l, O.id).univers;
  const donnees = univers.map((e) => e.donnee);
  assert.deepEqual(possibilitesDeLiaison(donnees, derive), possibilitesDeLiaison(donnees, D), 'atomes identiques');
  assert.deepEqual(empreintesDesContrats(derive), empreintesDesContrats(D), 'empreintes d\'opérations identiques');
  assert.throws(() => ctx(l, O.id, derive), TypeError);
  // ce que la dérive changerait réellement : l'espace applications/choix de T3 (resoudreElements redeviendrait application déterminée puis échouerait)
  const t3 = tours[2].S;
  const sans = applicationsSollicitables(t3.observation, derive, t3.univers);
  const avec = applicationsSollicitables(t3.observation, D, t3.univers);
  assert.equal(sans.applications.some((a) => a.operation === 'resoudreElements'), true);
  assert.equal(avec.applications.some((a) => a.operation === 'resoudreElements'), false);
});

// ------------------------------------------------------------------------------------------------------------------------ B. ORDRE DES CONTRÔLES
test('B1. ORDRE : structure relationnelle < preuve opérations < preuve catégorie < preuve relationnelle < reconstruction ; les refus le montrent', async () => {
  const { l } = await vecue();
  const O = clone(l.observations[l.observations.length - 1]);
  const essai = (mod, descriptions = D) => { const o = { ...clone(O), id: 'o-x', ...mod }; return () => ctx(l, 'o-x', descriptions, [...l.observations, o]); };
  // relationnelle fausse + donnée non résoluble : le refus nomme le contrat relationnel (avant la reconstruction)
  assert.throws(essai({ empreintesContratsRelationnels: PREUVE(H('e')), donneesExaminees: [...O.donneesExaminees, 'inconnue-zzz'].sort() }), /contrat relationnel/);
  // catégorie fausse + relationnelle fausse : la catégorie gagne
  assert.throws(essai({ empreintesCategoriesDonnees: [{ categorie: 'entrees-de-production', empreinte: H('c') }], empreintesContratsRelationnels: PREUVE(H('e')) }), /contrat de la catégorie/);
  // opérations fausses + relationnelle fausse : les opérations gagnent
  const ops = clone(O.empreintesOperationsExaminees); ops[0].empreinte = H('b');
  assert.throws(essai({ empreintesOperationsExaminees: ops, empreintesContratsRelationnels: PREUVE(H('e')) }), /contrat mécanique/);
  // structure invalide : refus de structure, avant tout recalcul
  assert.throws(essai({ empreintesContratsRelationnels: [] }), /empreintesContratsRelationnels/);
  // dérive relationnelle ET atomes dérivés : la preuve relationnelle refuse avant la comparaison des atomes
  const derive = modifier((c) => { if (c.nom === 'resoudreElements') delete c.relations; });
  assert.throws(essai({ possibilites: [] }, derive), /contrat relationnel/);
  const code = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
  const pos = (m) => code.indexOf(m);
  assert.ok(pos('empreintesDesContrats(sousCatalogue)') < pos('empreinteContratEntreesProduction()'));
  assert.ok(pos('empreinteContratEntreesProduction()') < pos('empreinteRelations(sousCatalogue)'));
  assert.ok(pos('empreinteRelations(sousCatalogue)') < pos('resoudreIdentitesDonnees(donneesExaminees'));
  assert.ok(pos('resoudreIdentitesDonnees(donneesExaminees') < pos('possibilitesDeLiaison(univers'));
  assert.equal((code.match(/empreinteRelations\(/g) || []).length, 1, 'source unique, aucune seconde canonisation');
  assert.match(lu('app', 'langage', 'contexte-observation.js'), /empreinte RELATIONNELLE \(v0\.63\.63\) -> univers -> possibilités recalculées/);
});
test('B2. SOUS-CATALOGUE HISTORIQUE : une opération AJOUTÉE depuis (hors operationsExaminees), même avec des relations, ne fait pas refuser ; comme pour la preuve des opérations', async () => {
  const { l } = await vecue();
  const O = l.observations[l.observations.length - 1];
  const plus = [...D, { ...structuredClone(D.find((d) => d.nom === 'resoudreElements')), nom: 'resoudreElementsBis' }];
  assert.notEqual(empreinteRelations(plus), empreinteRelations(D));
  assert.equal(ctx(l, O.id, plus).observation, O);
});

// ------------------------------------------------------------------------------------------------------------------------ C. 6 / 7 / 8 CLÉS
test('C1. 6, 7 et 8 clés : comportement STRICTEMENT inchangé ; aucune empreinte inventée ; acceptées même sous un catalogue aux relations dérivées', async () => {
  const { l } = await vecue();
  const O = l.observations[l.observations.length - 1];
  const sans = (...cles) => { const c = clone(O); for (const k of cles) delete c[k]; return c; };
  const o8 = { ...sans('empreintesContratsRelationnels'), id: 'o-8' };
  const o7 = { ...sans('empreintesContratsRelationnels', 'empreintesCategoriesDonnees'), id: 'o-7' };
  const o6 = { ...sans('empreintesContratsRelationnels', 'empreintesCategoriesDonnees', 'empreintesOperationsExaminees'), id: 'o-6' };
  const lignes = [...l.observations, o8, o7, o6];
  const derive = modifier((c) => { if (c.nom === 'resoudreElements') delete c.relations; });
  for (const catalogue of [D, derive]) for (const o of [o8, o7, o6]) {
    const avant = JSON.stringify(o);
    const r = ctx(l, o.id, catalogue, lignes);
    assert.equal(r.observation, o);
    assert.equal(JSON.stringify(o), avant, 'aucune mutation, aucun champ ajouté');
    assert.equal(Object.hasOwn(o, 'empreintesContratsRelationnels'), false);
  }
  assert.throws(() => ctx(l, O.id, derive), TypeError, 'la même ligne en 9 clés, elle, refuse');
});

// ------------------------------------------------------------------------------------------------------------------------ D. REDÉMARRAGE, MUTATION, FALLBACK
test('D1. REDÉMARRAGE (copie JSON) : la preuve est vérifiée à CHAQUE reconstruction, acceptée avec le bon catalogue, refusée avec un catalogue dérivé', async () => {
  const { l } = await vecue();
  const copie = clone(l);
  const derive = modifier((c) => { if (c.nom === 'couvrirSequence') delete c.relations; });
  for (let tour = 0; tour < 2; tour += 1) {
    for (const o of copie.observations) {
      assert.doesNotThrow(() => ctx(copie, o.id));
      assert.throws(() => ctx(copie, o.id, derive), TypeError);
    }
  }
});
test('D2. AUCUNE MUTATION, AUCUN REPLI : lignes, valeurs, exécutions et catalogue gelés en profondeur ; un refus ne modifie rien et ne bascule jamais vers la garantie faible', async () => {
  const { l } = await vecue();
  const gel = (x) => { if (x !== null && typeof x === 'object') { Object.values(x).forEach(gel); Object.freeze(x); } return x; };
  const fige = gel(clone(l)); const cat = gel(clone(D));
  const avant = JSON.stringify(fige);
  const O = fige.observations[fige.observations.length - 1];
  assert.doesNotThrow(() => ctx(fige, O.id, cat));
  const derive = gel(modifier((c) => { if (c.nom === 'resoudreElements') delete c.relations; }));
  assert.throws(() => ctx(fige, O.id, derive), TypeError);
  assert.equal(JSON.stringify(fige), avant);
  // preuve présente mais fausse != preuve absente : retirer la preuve la fait accepter (autre génération), la garder fausse la fait refuser
  const fausse = { ...clone(O), id: 'o-f', empreintesContratsRelationnels: PREUVE(H('9')) };
  assert.throws(() => ctx(l, 'o-f', D, [...l.observations, fausse]), TypeError);
  const code = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
  assert.equal(/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(code), false, 'aucun catch vide');
  assert.equal(/preuveRelations\s*=\s*null\s*;/.test(code), false, 'aucun repli : la preuve présente n\'est jamais écartée');
});

// ------------------------------------------------------------------------------------------------------------------------ E. LE VIVANT NE CHANGE PAS
test('E1. SCÉNARIO 7 TOURS INCHANGÉ : choix 0,1,2,11,11,11,11 ; auto 2,3,10,2,2,2,2 ; zéro echec_* ; 23 exécutions', async () => {
  const { tours, l } = await vecue();
  assert.deepEqual(tours.map((t) => t.S.choixAFaire.length), [0, 1, 2, 11, 11, 11, 11]);
  assert.deepEqual(tours.map((t) => t.S.automatiques.length), [2, 3, 10, 2, 2, 2, 2]);
  for (const t of tours) assert.deepEqual(t.S.automatiques.filter((r) => r.statut !== 'executee'), []);
  assert.equal(l.executions.length, 23);
});
test('E2. seul contexte-observation.js (et ses tests) change : les fichiers du vivant ne mentionnent ni la preuve relationnelle ni son recalcul', () => {
  for (const f of ['observation-possibilites.js', 'applications-sollicitables.js', 'relations-entrees.js', 'relations-schema.js', 'execution-mecanique.js', 'descriptions-operations.js', 'connaissances.js']) {
    const code = sansCommentaires(lu('app', 'langage', f));
    if (f === 'observation-possibilites.js') assert.equal((code.match(/empreinteRelations\(/g) || []).length, 1, 'le producteur calcule (v0.63.62), ne vérifie pas');
    else assert.equal(/empreinteRelations|canoniqueRelations/.test(code), false, f);
  }
});
// === FIN_TEST_PREUVE_RELATIONNELLE_VERIFIEE ===
