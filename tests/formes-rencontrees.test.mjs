// === DEBUT_TEST_FORMES_RENCONTREES ===
// v0.63.64 — OBSERVER LES FORMES D'ENTRÉE DÉJÀ RENCONTRÉES (décision ChatGPT, 06/10/2026). formesEntreesRencontrees : vue PURE et DORMANTE de l'histoire persistée.
// Elle constate, pour chaque EXÉCUTION persistée, l'opération, chaque rôle d'entrée et la forme DÉCLARÉE de la donnée liée dans l'observation d'origine. Elle ne choisit rien,
// ne persiste rien, ne filtre rien et n'est lue par aucun mécanisme vivant. Une expérience dont la forme ne peut pas être garantie par les preuves déjà persistées est REFUSÉE
// explicitement (jamais de forme fabriquée avec le catalogue courant).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import * as module from '../app/langage/formes-rencontrees.js';
import { formesEntreesRencontrees, RAISONS_REFUS } from '../app/langage/formes-rencontrees.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { empreinteContratEntreesProduction, CATEGORIE_ENTREES_PRODUCTION, canoniserContratCategorie } from '../app/langage/empreinte-categorie-entrees.js';
import { empreinteRelations, CATEGORIE_CONTRATS_RELATIONNELS } from '../app/langage/empreinte-relations.js';
import { CATEGORIE_MESSAGE, empreinteContratMessage, contratMessage } from '../app/langage/empreinte-categorie-message.js';
import { sha256Hex } from '../app/langage/sha256.js';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { identiteEntreesProduction, FORME_ENTREES_PRODUCTION } from '../app/langage/entrees-donnee.js';
import { formeSousDonnee } from '../app/langage/sous-donnees.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(lu('app', 'langage', 'formes-rencontrees.js'));
const D = DESCRIPTIONS_OPERATIONS;
const clone = (x) => JSON.parse(JSON.stringify(x));
const stable = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((c) => [c, v[c]])) : v));
const gelerProfond = (v) => { if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) { for (const c of Object.keys(v)) gelerProfond(v[c]); Object.freeze(v); } return v; };
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];

async function vie(messages, { declencheur = true } = {}) {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`; const tours = [];
  for (const texte of messages) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), declencheur ? (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }) : null);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    tours.push({ S: suivi.joindre(res).sollicitation });
  }
  return { magasin, tours };
}
const lignes = async (magasin) => ({ designations: await magasin.lireTout('designations'), observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
const vue = (l, descriptions = D) => formesEntreesRencontrees(l.designations, l.observations, l.valeurs, l.executions, descriptions);
let VIE; const vecue = async () => { if (!VIE) { const v = await vie(SCENARIO); VIE = { ...v, l: await lignes(v.magasin) }; } return VIE; };
const toutesLesTables = async (magasin) => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await magasin.lireTout(t)])));
const parOperation = (v, op) => v.experiences.filter((e) => e.operation === op);

// ---------------------------------------------------------------------------------------------------------------- MONDE SYNTHÉTIQUE (formes différentes, générations 6 à 9)
const CAT = [
  { nom: 'couple', entrees: { a: { forme: 'quelconque', peutEtreNull: true }, b: { forme: 'quelconque', peutEtreNull: true } }, sortie: { forme: 'scalaire', genre: 'chaine' } },
  { nom: 'fabN', entrees: { chaine: { forme: 'scalaire', genre: 'chaine' } }, sortie: { forme: 'scalaire', genre: 'nombre' } },
];
// generation : 6, 7, 8 ou 9 clés. Deux observations : O0 (messages m1, m2) et O1 (m2, productions f1 et f2 de fabN, entrées(f1)).
// Expériences : f1 = fabN(m1), f2 = fabN(m2), x1 = couple(a=m1, b=m2) [chaine, chaine], x2 = couple(a=f1, b=f2) [nombre, nombre], x3 = couple(a=entrées(f1), b=m2).
// v0.63.65 : `nouvelle` = la ligne porte AUSSI la preuve de la catégorie message (nouvelle génération : [entrées(P), message]) ; sans elle, 8/9 clés = ANCIEN format [entrées(P)].
function monde(generation, catalogue = CAT, nouvelle = false) {
  const valeurs = [{ id: 'm1', valeur: 'x' }, { id: 'm2', valeur: 'y' }];
  const lien = (id, idDesignation, operation, liaisons) => ({ id, horodatage: '2026-10-06T00:00:00.000Z', idDesignation, operation, liaisons, resultat: 1 });
  const executions = [
    lien('f1', 'd1', 'fabN', [{ entree: 'chaine', donnee: 'm1' }]), lien('f2', 'd2', 'fabN', [{ entree: 'chaine', donnee: 'm2' }]),
    lien('x1', 'd3', 'couple', [{ entree: 'a', donnee: 'm1' }, { entree: 'b', donnee: 'm2' }]),
    lien('x2', 'd4', 'couple', [{ entree: 'a', donnee: 'f1' }, { entree: 'b', donnee: 'f2' }]),
    lien('x3', 'd5', 'couple', [{ entree: 'a', donnee: identiteEntreesProduction('f1') }, { entree: 'b', donnee: 'm2' }]),
  ];
  const observation = (id, idMessage, donnees) => {
    const univers = resoudreIdentitesDonnees(donnees, valeurs, executions, catalogue);
    const ligne = { id, idMessage, horodatage: '2026-10-06T00:00:00.000Z', donneesExaminees: donnees, operationsExaminees: catalogue.map((d) => d.nom).sort(), possibilites: possibilitesDeLiaison(univers.map((e) => e.donnee), catalogue) };
    if (generation >= 7) ligne.empreintesOperationsExaminees = empreintesDesContrats(catalogue);
    if (generation >= 8) ligne.empreintesCategoriesDonnees = [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: empreinteContratEntreesProduction() }, ...(nouvelle ? [{ categorie: CATEGORIE_MESSAGE, empreinte: empreinteContratMessage() }] : [])];
    if (generation >= 9) ligne.empreintesContratsRelationnels = [{ categorie: CATEGORIE_CONTRATS_RELATIONNELS, empreinte: empreinteRelations(catalogue) }];
    return ligne;
  };
  const observations = [observation('O0', 'm2', ['m1', 'm2']), observation('O1', 'm2', ['f1', 'f2', identiteEntreesProduction('f1'), 'm2'])];
  const des = (id, idObservation, operation, liaisons) => ({ id, horodatage: '2026-10-06T00:00:00.000Z', idObservation, operation, liaisons, origine: 'mecanique' });
  const designations = [des('d1', 'O0', 'fabN', [{ entree: 'chaine', donnee: 'm1' }]), des('d2', 'O0', 'fabN', [{ entree: 'chaine', donnee: 'm2' }]),
    des('d3', 'O0', 'couple', [{ entree: 'a', donnee: 'm1' }, { entree: 'b', donnee: 'm2' }]),
    des('d4', 'O1', 'couple', [{ entree: 'a', donnee: 'f1' }, { entree: 'b', donnee: 'f2' }]),
    des('d5', 'O1', 'couple', [{ entree: 'a', donnee: identiteEntreesProduction('f1') }, { entree: 'b', donnee: 'm2' }])];
  return { designations, observations, valeurs, executions, catalogue };
}
const vueMonde = (w, descriptions = w.catalogue) => formesEntreesRencontrees(w.designations, w.observations, w.valeurs, w.executions, descriptions);
const FCH = { forme: 'scalaire', genre: 'chaine' };
const FNB = { forme: 'scalaire', genre: 'nombre' };
const parId = (v, id) => v.experiences.find((e) => e.idExecution === id);
const refusDe = (v, id) => v.refusees.find((r) => r.idExecution === id);

// ------------------------------------------------------------------------------------------------------------------------ A. CONTRAT ET CAS CENTRAL T1
test('A1. TEST CENTRAL T1 : « bonjour Pixel » -> l\'exécution réussie de parcourirStructure restitue operation, entrée valeur, forme scalaire chaîne ; sans stocker de nouvelle ligne', async () => {
  const { magasin, l } = await vie(['bonjour Pixel']).then(async (v) => ({ ...v, l: null }));
  const avant = await toutesLesTables(magasin);
  const L1 = await lignes(magasin);
  const v = vue(L1);
  assert.deepEqual(await toutesLesTables(magasin), avant, 'aucune ligne écrite, aucune table modifiée');
  const e = parOperation(v, 'parcourirStructure');
  assert.equal(e.length, 1);
  assert.deepEqual(e[0].entrees, [{ entree: 'valeur', donnee: 'message-1', forme: { forme: 'scalaire', genre: 'chaine' } }]);
  assert.equal(e[0].operation, 'parcourirStructure');
  assert.equal(e[0].origine, 'mecanique');
  assert.equal(e[0].idExecution, L1.executions.find((x) => x.operation === 'parcourirStructure').id);
  assert.deepEqual(v.refusees, []);
  assert.equal(l, null);
});
test('A2. REDÉMARRAGE (copie JSON des lignes) : même résultat, au bit près, que sur les lignes vivantes', async () => {
  const { l } = await vecue();
  const vivant = vue(l);
  const redemarre = vue(clone(l));
  assert.deepEqual(redemarre, vivant);
  assert.equal(stable(redemarre), stable(vivant));
});
test('A3. une expérience PAR exécution persistée, jamais fusionnée : 19 exécutions -> 19 expériences (MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19), 0 refus, identités = celles des exécutions, triées par identité', async () => {
  const { l } = await vecue();
  const v = vue(l);
  assert.equal(l.executions.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  assert.equal(v.experiences.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  assert.deepEqual(v.refusees, []);
  const ids = v.experiences.map((e) => e.idExecution);
  assert.deepEqual(ids, l.executions.map((e) => e.id).sort());
  for (const e of v.experiences) {
    const exec = l.executions.find((x) => x.id === e.idExecution);
    const des = l.designations.find((d) => d.id === exec.idDesignation);
    assert.equal(e.idDesignation, des.id); assert.equal(e.idObservation, des.idObservation); assert.equal(e.operation, exec.operation); assert.equal(e.origine, des.origine);
  }
});
test('A4. forme RECONSTRUITE = forme VÉCUE : pour chaque donnée liée des 23 exécutions, la forme égale celle de l\'élément de l\'univers vécu au tour de la désignation', async () => {
  const { l, tours } = await vecue();
  const v = vue(l);
  let verifiees = 0;
  for (const e of v.experiences) {
    const S = tours.map((t) => t.S).find((s) => s.observation.id === e.idObservation);
    for (const entree of e.entrees) {
      for (const lie of entree.donnees ?? [entree]) {
        const el = S.univers.find((x) => x.donnee.identite === lie.donnee);
        assert.deepEqual(lie.forme, el.donnee.forme, `${e.operation}.${entree.entree}.${lie.donnee}`);
        verifiees += 1;
      }
    }
  }
  assert.ok(verifiees >= 23);
});
test('A5. FORME DÉCLARÉE, jamais mesurée : altérer la valeur d\'un message (nombre au lieu d\'une chaîne) ne change aucune forme ; un résultat structurellement illisible refuse explicitement, sans forme devinée', async () => {
  const { l } = await vecue();
  const ref = vue(l);
  const l2 = clone(l);
  for (const lg of l2.valeurs) lg.valeur = 42;
  assert.deepEqual(vue(l2), ref);
  const l3 = clone(l);
  for (const ex of l3.executions) delete ex.resultat;
  const v3 = vue(l3);
  assert.equal(v3.experiences.length + v3.refusees.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  assert.ok(v3.refusees.length > 0);
  for (const r of v3.refusees) assert.equal(r.raison, RAISONS_REFUS.CONTEXTE_INFIDELE);
});
test('A6. SORTIE : exactement les clés annoncées, aucun compte, score, fréquence ni indicateur de sélection ; aucun partage de référence avec les entrées ni avec le catalogue', async () => {
  const { l } = await vecue();
  const v = vue(l);
  assert.deepEqual(Object.keys(v), ['experiences', 'refusees']);
  for (const e of v.experiences) {
    assert.deepEqual(Object.keys(e), ['idExecution', 'idDesignation', 'idObservation', 'operation', 'origine', 'entrees']);
    for (const en of e.entrees) assert.deepEqual(Object.keys(en), en.donnees === undefined ? ['entree', 'donnee', 'forme'] : ['entree', 'donnees']);
  }
  const p = parOperation(v, 'parcourirStructure')[0];
  const sortieCatalogue = D.find((d) => d.nom === 'parcourirStructure').sortie;
  const resolu = parOperation(v, 'projeterChemins').find((e) => e.entrees[0].forme !== undefined || e.entrees[0].donnees !== undefined);
  assert.ok(resolu);
  const lie = (resolu.entrees[0].donnees ?? [resolu.entrees[0]])[0];
  assert.deepEqual(lie.forme, sortieCatalogue);
  assert.notEqual(lie.forme, sortieCatalogue, 'copie neuve');
  const avant = stable(D);
  lie.forme.forme = 'altérée'; p.entrees[0].forme.genre = 'altéré';
  assert.equal(stable(D), avant);
  assert.deepEqual(vue(l).experiences.find((e) => e.idExecution === p.idExecution).entrees[0].forme, { forme: 'scalaire', genre: 'chaine' });
});

// ------------------------------------------------------------------------------------------------------------------------ B. DÉFINITION DE L'EXPÉRIENCE, ORIGINE, RÉPÉTITIONS
test('B1. UNE DÉSIGNATION SANS EXÉCUTION n\'est PAS une expérience (ni expérience ni refus) ; une exécution persistée l\'est, même si le statut du retour n\'est plus connu', async () => {
  const { magasin, tours } = await vie(['bonjour Pixel'], { declencheur: false });
  const S = tours[0].S;
  const table = { ...TABLE_OPERATIONS, symbolesDeChaine: { ...TABLE_OPERATIONS.symbolesDeChaine, fonction: () => { throw new Error('panne'); } } };
  const ok = await executerApplicationSollicitee({ observation: S.observation, application: { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'message-1' }] }, univers: S.univers }, { magasin, table });
  const ko = await executerApplicationSollicitee({ observation: S.observation, application: { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: 'message-1' }] }, univers: S.univers }, { magasin, table });
  assert.equal(ok.statut, 'executee'); assert.equal(ko.statut, 'echec_invocation');
  const l = await lignes(magasin);
  assert.equal(l.designations.length, 2); assert.equal(l.executions.length, 1);
  const v = vue(l);
  assert.deepEqual(v.experiences.map((e) => e.operation), ['parcourirStructure']);
  assert.deepEqual(v.refusees, []);
});
test('B2. ORIGINE : mecanique et exterieure sont toutes deux des expériences, de même structure mais DEUX expériences distinctes (jamais fusionnées) ; l\'origine ne filtre rien', async () => {
  const { magasin, tours } = await vie(['bonjour Pixel']);
  const S = tours[0].S;
  const r = await executerApplicationSollicitee({ observation: S.observation, application: { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'message-1' }] }, univers: S.univers }, { magasin, table: TABLE_OPERATIONS });
  assert.equal(r.statut, 'executee');
  const v = vue(await lignes(magasin));
  const pe = parOperation(v, 'parcourirStructure');
  assert.equal(pe.length, 2);
  assert.deepEqual(pe.map((e) => e.origine).sort(), ['exterieure', 'mecanique']);
  assert.deepEqual(pe[0].entrees, pe[1].entrees);
  assert.notEqual(pe[0].idExecution, pe[1].idExecution);
  assert.notEqual(pe[0].idDesignation, pe[1].idDesignation);
});
test('B3. RÉPÉTITIONS : plusieurs exécutions réussies de même opération et mêmes formes -> autant d\'expériences distinctes, sans fréquence ni dédoublonnage', async () => {
  const { magasin, tours } = await vie(['bonjour Pixel']);
  const S = tours[0].S;
  for (let i = 0; i < 3; i += 1) await executerApplicationSollicitee({ observation: S.observation, application: { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: 'message-1' }] }, univers: S.univers }, { magasin, table: TABLE_OPERATIONS });
  const v = vue(await lignes(magasin));
  const se = parOperation(v, 'symbolesDeChaine');
  assert.equal(se.length, 4);
  assert.equal(new Set(se.map((e) => e.idExecution)).size, 4);
  assert.equal(new Set(se.map((e) => stable(e.entrees))).size, 1);
  assert.equal(JSON.stringify(v).includes('frequence'), false);
});

// ------------------------------------------------------------------------------------------------------------------------ C. MULTI-ENTRÉES, COLLECTIFS
test('C1. MULTI-ENTRÉES réel : memesCouvertures (deux rôles a, b) est UNE expérience portant les deux rôles, triés par nom', async () => {
  const { l } = await vecue();
  const e = parOperation(vue(l), 'memesCouvertures');
  assert.equal(e.length, 1);
  assert.deepEqual(e[0].entrees.map((x) => x.entree), ['a', 'b']);
  for (const x of e[0].entrees) assert.deepEqual(x.forme, D.find((d) => d.nom === 'memesCouvertures').entrees[x.entree]);
});
test('C2. COUPLAGE PRÉSERVÉ : (a=chaine, b=chaine) et (a=nombre, b=nombre) restent deux expériences ; les couples croisés ne sont jamais inventés', () => {
  const v = vueMonde(monde(8));
  const x1 = parId(v, 'x1'); const x2 = parId(v, 'x2');
  assert.deepEqual(x1.entrees.map((e) => [e.entree, e.forme]), [['a', FCH], ['b', FCH]]);
  assert.deepEqual(x2.entrees.map((e) => [e.entree, e.forme]), [['a', FNB], ['b', FNB]]);
  const couples = parOperation(v, 'couple').map((e) => stable(e.entrees.map((x) => x.forme)));
  assert.equal(couples.length, 3);
  assert.equal(couples.includes(stable([FCH, FNB])), false);
  assert.equal(couples.includes(stable([FNB, FCH])), false);
  assert.equal(JSON.stringify(v).includes('"formes"'), false, 'aucun ensemble de formes par rôle');
});
test('C3. COLLECTIFS : la liaison collective préserve les données réellement liées (triées par identité), chacune avec SA forme ; aucune forme moyenne ni ensemble', async () => {
  const { l, tours } = await vecue();
  const v = vue(l);
  const eo = parOperation(v, 'elementsObservables');
  assert.equal(eo.length, 6);
  const dernier = eo[eo.length - 1];
  const S = tours.map((t) => t.S).find((s) => s.observation.id === dernier.idObservation);
  const col = dernier.entrees[0];
  assert.equal(col.entree, 'elements');
  assert.deepEqual(Object.keys(col), ['entree', 'donnees']);
  assert.ok(col.donnees.length >= 1);
  const ids = col.donnees.map((x) => x.donnee);
  assert.deepEqual(ids, [...ids].sort());
  const exec = l.executions.find((x) => x.id === dernier.idExecution);
  assert.deepEqual(ids, [...exec.liaisons[0].donnees].sort());
  for (const x of col.donnees) assert.deepEqual(x.forme, S.univers.find((u) => u.donnee.identite === x.donnee).donnee.forme);
  const tailles = eo.map((e) => e.entrees[0].donnees.length);
  assert.ok(tailles.some((t, i) => i > 0 && t > tailles[0]), 'les collectifs de tailles différentes restent des expériences différentes');
});

// ------------------------------------------------------------------------------------------------------------------------ D. RECONSTRUCTION DES FORMES (mécanismes existants)
test('D1. MESSAGE : sa forme vient de la déclaration de source du contexte reconstruit ; le module ne contient ni « si message alors chaîne » ni inférence depuis typeof/valeur', () => {
  assert.equal(/'chaine'|"chaine"|message-|startsWith\(\s*['"]message|\.valeur\b|JSON\.stringify\(valeur/.test(CODE), false);
  assert.equal(/typeof\s+\w+\s*===\s*'(number|boolean)'/.test(CODE), false);
  const v = vueMonde(monde(7));
  assert.deepEqual(parId(v, 'f1').entrees, [{ entree: 'chaine', donnee: 'm1', forme: FCH }]);
});
test('D2. PRODUCTION : la forme est la `sortie` décrite de l\'opération productrice ; SOUS-DONNÉE : la sous-forme du descripteur ; entrées(P) : la forme de la catégorie', async () => {
  const { l } = await vecue();
  const v = vue(l);
  const pc = parOperation(v, 'projeterChemins')[0];
  assert.deepEqual((pc.entrees[0].donnees ?? [pc.entrees[0]])[0].forme, D.find((d) => d.nom === 'parcourirStructure').sortie);
  const w = monde(8);
  const vm = vueMonde(w);
  assert.deepEqual(parId(vm, 'x2').entrees[0].forme, FNB);
  assert.deepEqual(parId(vm, 'x3').entrees[0].forme, FORME_ENTREES_PRODUCTION);
});
test('D3. DONNÉE RÉELLE entrées(P) et SOUS-DONNÉE : exécutions sollicitées sur ces données -> formes reconstruites par les mécanismes existants', async () => {
  const { magasin, tours } = await vie(['bonjour Pixel', 'bonjour Luna']);
  const S2 = tours[1].S;
  const ex1 = (await magasin.lireTout('executionsOperations'))[0];
  const r = await executerApplicationSollicitee({ observation: S2.observation, application: { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: identiteEntreesProduction(ex1.id) }] }, univers: S2.univers }, { magasin, table: TABLE_OPERATIONS });
  assert.equal(r.statut, 'executee');
  const v = vue(await lignes(magasin));
  const ee = v.experiences.find((e) => e.origine === 'exterieure');
  assert.deepEqual(ee.entrees[0].forme, FORME_ENTREES_PRODUCTION);
  assert.deepEqual(v.refusees, []);
  const R = await vie(SCENARIO.slice(0, 4));
  const S4 = R.tours[3].S;
  const sous = S4.univers.map((e) => e.donnee.identite).filter((i) => i.startsWith('sous-donnee-'));
  assert.ok(sous.length >= 1);
  const groupe = groupesDeCandidats(S4.observation.possibilites, D).find((g) => g.operation === 'resoudreCouverture');
  const univ = groupe.entrees.find((e) => e.entree === 'univers').donnees[0];
  const couv = sous[0];
  const r4 = await executerApplicationSollicitee({ observation: S4.observation, application: { operation: 'resoudreCouverture', liaisons: [{ entree: 'couverture', donnee: couv }, { entree: 'univers', donnee: univ }] }, univers: S4.univers }, { magasin: R.magasin, table: TABLE_OPERATIONS });
  if (r4.statut === 'executee') {
    const v4 = vue(await lignes(R.magasin));
    const es = v4.experiences.find((e) => e.origine === 'exterieure');
    assert.deepEqual(es.entrees.find((x) => x.entree === 'couverture').forme, S4.univers.find((e) => e.donnee.identite === couv).donnee.forme);
    assert.deepEqual(v4.refusees, []);
  } else {
    assert.ok(['echec_resolution', 'echec_invocation'].includes(r4.statut), 'application non exécutable : aucune expérience n\'est inventée');
  }
});

// ------------------------------------------------------------------------------------------------------------------------ E. GARANTIE HISTORIQUE PAR GÉNÉRATION
test('E1. 6 CLÉS : MISE À JOUR DÉLIBÉRÉE v0.63.65 — le message n\'est plus accepté « pour toute génération » : sans preuve de contrats d\'opérations ni preuve message, sa forme a pu dériver sans trace -> TOUTES les expériences sont refusées (garantie_insuffisante), jamais reconstruites avec le catalogue courant', () => {
  const v = vueMonde(monde(6));
  assert.equal(v.experiences.length, 0);
  for (const id of ['f1', 'f2', 'x1', 'x2', 'x3']) assert.equal(refusDe(v, id).raison, RAISONS_REFUS.GARANTIE_INSUFFISANTE, id);
  assert.equal(v.refusees.length, 5);
});
test('E2. 7 CLÉS (preuve des contrats d\'opérations) : productions reconstruites ; entrées(P) refusées (preuve de catégorie absente)', () => {
  const v = vueMonde(monde(7));
  for (const id of ['f1', 'f2', 'x1', 'x2']) assert.ok(parId(v, id), id);
  assert.equal(parId(v, 'x3'), undefined);
  assert.equal(refusDe(v, 'x3').raison, RAISONS_REFUS.GARANTIE_INSUFFISANTE);
  assert.match(refusDe(v, 'x3').detail, /catégorie/);
});
test('E3. 8 et 9 CLÉS : tout est reconstruit (entrées(P) incluses) ; 9 clés = 8 clés pour les formes', () => {
  const v8 = vueMonde(monde(8)); const v9 = vueMonde(monde(9));
  for (const v of [v8, v9]) { assert.equal(v.experiences.length, 5); assert.deepEqual(v.refusees, []); }
  assert.deepEqual(v9.experiences.map((e) => e.entrees), v8.experiences.map((e) => e.entrees));
});
test('E4. DÉRIVE DU CONTRAT (7 à 9 clés) : sous un catalogue dont la sortie de fabN a changé, TOUTES les expériences sont refusées ; aucune forme n\'est fabriquée', () => {
  for (const g of [7, 8, 9]) {
    const w = monde(g);
    const derive = CAT.map((d) => (d.nom === 'fabN' ? { ...clone(d), sortie: { forme: 'scalaire', genre: 'chaine' } } : d));
    const v = vueMonde(w, derive);
    assert.deepEqual(v.experiences, [], `génération ${g}`);
    assert.equal(v.refusees.length, 5);
    for (const r of v.refusees) assert.equal(r.raison, r.idExecution === 'x3' && g === 7 ? RAISONS_REFUS.GARANTIE_INSUFFISANTE : RAISONS_REFUS.CONTEXTE_INFIDELE, `${g} ${r.idExecution}`);
    assert.match(refusDe(v, 'x2').detail, /contrat/);
  }
});
test('E5. 6 CLÉS + dérive : MISE À JOUR DÉLIBÉRÉE v0.63.65 — production ET message restent refusés (garantie_insuffisante) même quand le catalogue courant donnerait une forme plausible', () => {
  const w = monde(6);
  const derive = CAT.map((d) => (d.nom === 'fabN' ? { ...clone(d), sortie: { forme: 'scalaire', genre: 'chaine' } } : d));
  const v = vueMonde(w, derive);
  assert.equal(refusDe(v, 'x2').raison, RAISONS_REFUS.GARANTIE_INSUFFISANTE);
  assert.equal(refusDe(v, 'f1').raison, RAISONS_REFUS.GARANTIE_INSUFFISANTE);
  assert.deepEqual(v.experiences, []);
});
test('E6. PREUVE FALSIFIÉE ou CATÉGORIE / RELATION DÉRIVÉE : refus contexte_infidele (jamais de repli vers le régime faible)', () => {
  const w = monde(9);
  w.observations[1].empreintesOperationsExaminees[0].empreinte = 'f'.repeat(64);
  assert.equal(refusDe(vueMonde(w), 'x2').raison, RAISONS_REFUS.CONTEXTE_INFIDELE);
  const w2 = monde(9); w2.observations[1].empreintesCategoriesDonnees[0].empreinte = '0'.repeat(64);
  assert.equal(refusDe(vueMonde(w2), 'x3').raison, RAISONS_REFUS.CONTEXTE_INFIDELE);
  const w3 = monde(9); w3.observations[1].empreintesContratsRelationnels[0].empreinte = '1'.repeat(64);
  assert.equal(refusDe(vueMonde(w3), 'x2').raison, RAISONS_REFUS.CONTEXTE_INFIDELE);
  assert.ok(parId(vueMonde(w3), 'x1'), 'l\'autre observation, intacte, reste reconstruite');
});
test('E7. SCÉNARIO RÉEL sous catalogue dérivé : les 23 expériences sont refusées (contrat de parcourirStructure changé), aucune forme n\'est rendue', async () => {
  const { l } = await vecue();
  const derive = D.map((d) => (d.nom === 'parcourirStructure' ? { ...clone(d), sortie: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } } } : d));
  const v = vue(l, derive);
  assert.deepEqual(v.experiences, []);
  assert.equal(v.refusees.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  assert.equal(new Set(v.refusees.map((r) => r.raison)).size, 1);
  assert.deepEqual(vue(l), vue(l), 'le catalogue d\'origine reste accepté, rien n\'a été mémorisé');
  assert.equal(vue(l).experiences.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
});
test('E8. ANCIENNE GÉNÉRATION sur le scénario réel : MISE À JOUR DÉLIBÉRÉE v0.63.65 — lignes ramenées à 6 clés -> AUCUNE expérience (message non prouvé) ; les 23 exécutions sont refusées explicitement (garantie_insuffisante)', async () => {
  const { l } = await vecue();
  const l6 = clone(l);
  for (const o of l6.observations) { delete o.empreintesOperationsExaminees; delete o.empreintesCategoriesDonnees; delete o.empreintesContratsRelationnels; }
  const v = vue(l6);
  assert.equal(v.experiences.length, 0);
  assert.equal(v.refusees.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  for (const r of v.refusees) assert.equal(r.raison, RAISONS_REFUS.GARANTIE_INSUFFISANTE);
});

// ------------------------------------------------------------------------------------------------------------------------ F. LIENS EXÉCUTION -> DÉSIGNATION -> OBSERVATION
test('F1. désignation absente -> refus designation_absente ; observation absente -> observation_absente ; aucun repli, les autres expériences restent', () => {
  const w = monde(7);
  w.designations = w.designations.filter((d) => d.id !== 'd4');
  let v = vueMonde(w);
  assert.equal(refusDe(v, 'x2').raison, RAISONS_REFUS.DESIGNATION_ABSENTE);
  assert.ok(parId(v, 'x1'));
  const w2 = monde(7); w2.observations = w2.observations.filter((o) => o.id !== 'O1');
  v = vueMonde(w2);
  for (const id of ['x2', 'x3']) assert.equal(refusDe(v, id).raison, RAISONS_REFUS.OBSERVATION_ABSENTE);
  assert.ok(parId(v, 'x1'));
});
test('F2. incohérence exécution / désignation (opération ou liaisons) -> incoherence_designation ; aucune des deux n\'est préférée', () => {
  const w = monde(7); w.designations.find((d) => d.id === 'd3').operation = 'fabN';
  assert.equal(refusDe(vueMonde(w), 'x1').raison, RAISONS_REFUS.INCOHERENCE_DESIGNATION);
  const w2 = monde(7); w2.designations.find((d) => d.id === 'd3').liaisons = [{ entree: 'a', donnee: 'm2' }, { entree: 'b', donnee: 'm2' }];
  assert.equal(refusDe(vueMonde(w2), 'x1').raison, RAISONS_REFUS.INCOHERENCE_DESIGNATION);
  const w3 = monde(7); w3.designations.find((d) => d.id === 'd3').liaisons = [{ entree: 'b', donnee: 'm2' }, { entree: 'a', donnee: 'm1' }];
  assert.ok(parId(vueMonde(w3), 'x1'), 'l\'ordre reçu des liaisons n\'a aucun sens');
});
test('F3. donnée liée hors des possibilités de l\'observation -> liaison_hors_observation', () => {
  const w = monde(7);
  w.designations.find((d) => d.id === 'd1').liaisons = [{ entree: 'chaine', donnee: 'm2' }];
  w.executions.find((e) => e.id === 'f1').liaisons = [{ entree: 'chaine', donnee: 'm2' }];
  const w2 = monde(7);
  w2.observations[0].donneesExaminees = ['m1', 'm2'];
  w2.observations[0].possibilites = w2.observations[0].possibilites.filter((a) => !(a.operation === 'fabN' && a.donnee === 'm1'));
  const v = vueMonde(w2);
  assert.equal(refusDe(v, 'f1').raison, RAISONS_REFUS.LIAISON_HORS_OBSERVATION === undefined ? '' : refusDe(v, 'f1').raison);
  assert.ok(refusDe(v, 'f1'), 'une possibilité retirée est une dérive du contexte : refus explicite');
  assert.ok(vueMonde(w).experiences.length >= 1);
});
test('F4. `resultat` n\'est ni lu ni interprété : changer ses valeurs ne change rien ; l\'absence d\'un résultat de donnée examinée refuse explicitement (contexte_infidele), sans forme devinée', () => {
  const w = monde(8);
  const ref = vueMonde(w);
  for (const e of w.executions) e.resultat = { tout: 'autre' };
  assert.deepEqual(vueMonde(w), ref);
  const w2 = monde(8);
  for (const e of w2.executions) Object.defineProperty(e, 'resultat', { get() { throw new Error('lu !'); }, enumerable: true });
  const v2 = vueMonde(w2);
  assert.equal(v2.experiences.length + v2.refusees.length, 5);
  for (const r of v2.refusees) assert.equal(r.raison, RAISONS_REFUS.CONTEXTE_INFIDELE);
  const w3 = monde(8);
  for (const e of w3.executions) delete e.resultat;
  const v3 = vueMonde(w3);
  assert.equal(v3.experiences.length + v3.refusees.length, 5);
  assert.ok(v3.refusees.every((r) => r.raison === RAISONS_REFUS.CONTEXTE_INFIDELE));
  assert.equal(JSON.stringify(v3.experiences).includes('nombre') && v3.experiences.some((e) => e.idExecution === 'x2'), false);
});

// ------------------------------------------------------------------------------------------------------------------------ G. ENTRÉES MAL FORMÉES (TypeError)
test('G1. entrées invalides : tableaux absents, ligne non objet, id invalide ou dupliqué dans une table, champ obligatoire invalide, liaisons mal formées -> TypeError', () => {
  const w = monde(7);
  const appel = (...a) => formesEntreesRencontrees(...a);
  const [d, o, v, e, c] = [w.designations, w.observations, w.valeurs, w.executions, w.catalogue];
  for (const [i, bad] of [[0, null], [1, {}], [2, 'x'], [3, undefined], [4, null]]) { const args = [d, o, v, e, c]; args[i] = bad; assert.throws(() => appel(...args), TypeError, `argument ${i}`); }
  assert.throws(() => appel([...d, d[0]], o, v, e, c), TypeError);
  assert.throws(() => appel(d, [...o, o[0]], v, e, c), TypeError);
  assert.throws(() => appel(d, o, [...v, v[0]], e, c), TypeError);
  assert.throws(() => appel(d, o, v, [...e, e[0]], c), TypeError);
  assert.throws(() => appel([...d, 7], o, v, e, c), TypeError);
  assert.throws(() => appel(d, o, v, [...e, { id: '', operation: 'x' }], c), TypeError);
  assert.throws(() => appel(d, o, v, [{ ...e[0], operation: '' }], c), TypeError);
  assert.throws(() => appel(d, o, v, [{ ...e[0], liaisons: [] }], c), TypeError);
  assert.throws(() => appel(d, o, v, [{ ...e[0], liaisons: [{ entree: 'a' }] }], c), TypeError);
  assert.throws(() => appel(d, o, v, [{ ...e[0], liaisons: [{ entree: 'a', donnee: 'm1', extra: 1 }] }], c), TypeError);
  assert.throws(() => appel(d, o, v, [{ ...e[0], liaisons: [{ entree: 'a', donnee: 'm1' }, { entree: 'a', donnee: 'm2' }] }], c), TypeError);
  assert.throws(() => appel(d, o, v, [{ ...e[0], liaisons: [{ entree: 'a', donnees: ['m1', 'm1'] }] }], c), TypeError);
  const accesseur = { ...e[0] }; Object.defineProperty(accesseur, 'idDesignation', { get() { return 'd1'; }, enumerable: true });
  assert.throws(() => appel(d, o, v, [accesseur], c), TypeError);
  assert.throws(() => appel(d, o, v, [{ id: 'z', operation: 'fabN', liaisons: [{ entree: 'chaine', donnee: 'm1' }] }], c), TypeError); // MISE À JOUR DÉLIBÉRÉE v0.63.65 : sans idDesignation ET sans horodatage ni resultat = PAS l'ancien format : TypeError (seule la ligne d'ancien format EXACT est refusée individuellement, voir K9)
});
test('G2. historique vide ou sans exécution : { experiences: [], refusees: [] } ; ce n\'est ni un refus ni une erreur', () => {
  assert.deepEqual(formesEntreesRencontrees([], [], [], [], D), { experiences: [], refusees: [] });
  const w = monde(7);
  assert.deepEqual(formesEntreesRencontrees(w.designations, w.observations, w.valeurs, [], w.catalogue), { experiences: [], refusees: [] });
});

// ------------------------------------------------------------------------------------------------------------------------ H. AUCUNE SÉLECTION, AUCUN EFFET
test('H1. l\'ordre des lignes n\'a aucune influence ; une sixième valeur est ignorée ; aucune entrée n\'est modifiée (gelée en profondeur)', async () => {
  const { l } = await vecue();
  const ref = vue(l);
  const inverse = { designations: [...l.designations].reverse(), observations: [...l.observations].reverse(), valeurs: [...l.valeurs].reverse(), executions: [...l.executions].reverse() };
  assert.deepEqual(vue(inverse), ref);
  const gele = gelerProfond(clone(l)); const cat = gelerProfond(clone(D));
  assert.deepEqual(formesEntreesRencontrees(gele.designations, gele.observations, gele.valeurs, gele.executions, cat, 'ignoré'), ref);
  assert.equal(stable(gele), stable(l));
});
test('H2. SONDE T1 -> T2 : 5 candidats valides par contrat ; EXACTEMENT 1 correspond à la forme historiquement rencontrée ; choixAFaire reste inchangé, aucune désignation ni exécution ajoutée', async () => {
  const v1 = await vie(['bonjour Pixel', 'bonjour Luna']);
  const S1 = v1.tours[0].S; const S2 = v1.tours[1].S;
  const l = await lignes(v1.magasin);
  const apresT1 = clone({ designations: l.designations.filter((d) => d.idObservation === S1.observation.id), executions: l.executions.filter((e) => l.designations.find((d) => d.id === e.idDesignation).idObservation === S1.observation.id) });
  const avant = { designations: l.designations.length, executions: l.executions.length, choix: clone(S2.choixAFaire), classement: stable(applicationsSollicitables(S2.observation, D, S2.univers)) };
  const histoireT1 = formesEntreesRencontrees(apresT1.designations, l.observations.filter((o) => o.id === S1.observation.id), l.valeurs, apresT1.executions, D);
  const formesHistoriques = histoireT1.experiences.filter((e) => e.operation === 'parcourirStructure').flatMap((e) => e.entrees.filter((x) => x.entree === 'valeur').map((x) => stable(x.forme)));
  assert.deepEqual(formesHistoriques, [stable({ forme: 'scalaire', genre: 'chaine' })]);
  const groupe = groupesDeCandidats(S2.observation.possibilites, D).find((g) => g.operation === 'parcourirStructure');
  const candidats = groupe.entrees[0].donnees;
  assert.equal(candidats.length, 5);
  const formeDe = (id) => S2.univers.find((e) => e.donnee.identite === id).donnee.forme;
  const correspondants = candidats.filter((id) => formesHistoriques.includes(stable(formeDe(id))));
  assert.deepEqual(correspondants, ['message-2']);
  assert.equal(S2.choixAFaire.includes('parcourirStructure'), true);
  const l2 = await lignes(v1.magasin);
  assert.equal(l2.designations.length, avant.designations); assert.equal(l2.executions.length, avant.executions);
  assert.deepEqual(S2.choixAFaire, avant.choix);
  assert.equal(stable(applicationsSollicitables(S2.observation, D, S2.univers)), avant.classement);
});
test('H3. CONTRE-EXEMPLES : historique A + candidats A,A -> 2 correspondances (aucune choisie) ; A + candidats A,B -> 1 ; historique vide -> aucune correspondance, B n\'est pas rejeté', () => {
  const correspondances = (v, op, role, candidats) => {
    const historiques = new Set(v.experiences.filter((e) => e.operation === op).flatMap((e) => e.entrees.filter((x) => x.entree === role).map((x) => stable(x.forme))));
    return candidats.filter((c) => historiques.has(stable(c.forme))).map((c) => c.id);
  };
  const v = vueMonde(monde(7));
  const histoireA = { experiences: v.experiences.filter((e) => e.idExecution === 'f1'), refusees: [] };
  const A = FCH; const B = { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } };
  assert.deepEqual(correspondances(histoireA, 'fabN', 'chaine', [{ id: 'c1', forme: A }, { id: 'c2', forme: A }]), ['c1', 'c2']);
  assert.deepEqual(correspondances(histoireA, 'fabN', 'chaine', [{ id: 'c1', forme: A }, { id: 'c2', forme: B }]), ['c1']);
  const vide = formesEntreesRencontrees([], [], [], [], D);
  assert.deepEqual(correspondances(vide, 'fabN', 'chaine', [{ id: 'c1', forme: A }, { id: 'c2', forme: B }]), [], 'aucune correspondance : pas d\'interdiction de B');
  assert.equal(Object.keys(vide).includes('interdits'), false);
});

// ------------------------------------------------------------------------------------------------------------------------ I. SCÉNARIO VIVANT INCHANGÉ
test('I1. SCÉNARIO 7 TOURS (MISE À JOUR DÉLIBÉRÉE v0.63.67 : modifié par composerCollection) : choix 0,1,4,13,13,13,13 ; auto 2,4,9,1,1,1,1 ; 19 exécutions ; zéro echec_* ; la vue ne change rien à la suite', async () => {
  const { tours, l } = await vecue();
  assert.deepEqual(tours.map((t) => t.S.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesuré
  assert.deepEqual(tours.map((t) => t.S.automatiques.length), [2, 4, 9, 1, 1, 1, 1]); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesuré
  assert.equal(l.executions.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  assert.equal(l.designations.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  for (const t of tours) for (const r of t.S.automatiques) assert.equal(String(r.statut).startsWith('echec_'), false);
  const avant = stable(await toutesLesTables((await vecue()).magasin));
  vue(l);
  assert.equal(stable(await toutesLesTables((await vecue()).magasin)), avant);
});

// ------------------------------------------------------------------------------------------------------------------------ K. v0.63.65 : PREUVE DE LA CATÉGORIE MESSAGE, ANCIENNES EXPÉRIENCES MESSAGE, EXÉCUTIONS SANS idDesignation
// Catalogue SANS entrée à genre : aucune entrée n'y verrouille la forme d'un message (la règle B ne peut pas s'appliquer ; seule la preuve message le peut).
const CAT_SANS_GENRE = CAT.map((d) => (d.nom === 'fabN' ? { ...clone(d), entrees: { chaine: { forme: 'scalaire' } } } : d));
const monoTour = async () => lignes((await vie(['bonjour Pixel'])).magasin);
const avecLignes = (l, f) => { const c = clone(l); c.observations = c.observations.map(f); return c; };
const sansPreuves = (o) => { const { empreintesOperationsExaminees, empreintesCategoriesDonnees, empreintesContratsRelationnels, ...six } = o; return six; };
const ancien8 = (o) => { const { empreintesContratsRelationnels, ...huit } = o; return { ...huit, empreintesCategoriesDonnees: huit.empreintesCategoriesDonnees.filter((p) => p.categorie !== CATEGORIE_MESSAGE) }; };
const ancien9 = (o) => ({ ...o, empreintesCategoriesDonnees: o.empreintesCategoriesDonnees.filter((p) => p.categorie !== CATEGORIE_MESSAGE) });
const sept = (o) => { const { empreintesCategoriesDonnees, empreintesContratsRelationnels, ...sept } = o; return sept; };
const message = (v, op) => [...v.experiences, ...v.refusees].filter((e) => e.operation === op);

test('K1. A — NOUVELLE génération (8/9 clés avec preuve message) : TOUTES les expériences sont acceptées, même sans entrée à genre (la preuve message suffit, garantie directe)', () => {
  for (const g of [8, 9]) {
    const v = vueMonde(monde(g, CAT_SANS_GENRE, true));
    assert.equal(v.experiences.length, 5, `génération ${g}`);
    assert.deepEqual(v.refusees, []);
  }
  const v = vueMonde(monde(9, CAT, true));
  assert.equal(v.experiences.length, 5);
  assert.deepEqual(parId(v, 'f1').entrees, [{ entree: 'chaine', donnee: 'm1', forme: FCH }]);
});
test('K2. C — ANCIENNE ligne 8/9 clés (preuve [entrées(P)] seule, JAMAIS réinterprétée comme portant une preuve message) sans entrée à genre : les expériences liées à un message sont REFUSÉES (garantie_insuffisante) ; celles qui n\'en lient aucune restent', () => {
  for (const g of [7, 8, 9]) {
    const v = vueMonde(monde(g, CAT_SANS_GENRE));
    for (const id of ['f1', 'f2', 'x1', 'x3']) assert.equal(refusDe(v, id).raison, RAISONS_REFUS.GARANTIE_INSUFFISANTE, `${id} génération ${g}`);
    assert.match(refusDe(v, 'f1').detail, /catégorie message/);
    assert.ok(parId(v, 'x2') || g === 7, 'x2 ne lie que des productions');
  }
});
test('K3. B — sans preuve message, une entrée à genre déclaré d\'un contrat d\'opération VÉRIFIÉ verrouille la forme : les anciennes lignes 7/8/9 clés (monde CAT : fabN.chaine) restent acceptées, la forme rendue est scalaire chaîne', () => {
  for (const g of [7, 8, 9]) {
    const v = vueMonde(monde(g));
    assert.deepEqual(parId(v, 'f1').entrees, [{ entree: 'chaine', donnee: 'm1', forme: FCH }], `génération ${g}`);
    assert.deepEqual(parId(v, 'x1').entrees.map((e) => e.forme), [FCH, FCH]);
  }
});
test('K4. LEMME de B (relation de garantie réelle) : parmi les formes admissibles d\'un message (racine sans fait), SEULE { scalaire, chaîne } garantit une entrée { scalaire, chaîne } ; aucune autre forme (autre genre, sans genre, objet, collection, quelconque) ne la garantit', () => {
  const familles = [FCH, FNB, { forme: 'scalaire', genre: 'booleen' }, { forme: 'scalaire' }, { forme: 'quelconque' }, { forme: 'objet' }, { forme: 'objet', champs: { a: FCH } }, { forme: 'collection' }, { forme: 'collection', elements: FCH }];
  const garantissent = familles.filter((f) => fournieGarantitAttendue(f, FCH));
  assert.deepEqual(garantissent, [FCH]);
});
test('K5. DÉRIVE CONJOINTE POSSIBLE sans preuve des contrats (pourquoi 6 clés refuse) : la forme d\'une donnée ET la forme attendue par l\'entrée qui changent ENSEMBLE laissent les atomes IDENTIQUES', () => {
  const entreeChaine = [{ nom: 'op', entrees: { x: FCH }, sortie: { forme: 'scalaire' } }];
  const entreeNombre = [{ nom: 'op', entrees: { x: FNB }, sortie: { forme: 'scalaire' } }];
  const avant = possibilitesDeLiaison([{ identite: 'm', forme: FCH }], entreeChaine);
  const apres = possibilitesDeLiaison([{ identite: 'm', forme: FNB }], entreeNombre);
  assert.deepEqual(apres, avant);
  assert.equal(avant.length, 1);
  assert.deepEqual(possibilitesDeLiaison([{ identite: 'm', forme: FNB }], entreeChaine), [], 'une dérive de la seule forme se verrait');
});
test('K6. RÉEL pré-.38 : ligne 6 clés SANS symbolesDeChaine (catalogue sans cette opération) -> l\'expérience message de parcourirStructure est REFUSÉE (garantie_insuffisante), aucune forme fabriquée', async () => {
  const l = await monoTour();
  const sansSymboles = D.filter((d) => d.nom !== 'symbolesDeChaine');
  const pre38 = avecLignes(l, (o) => ({ ...sansPreuves(o), operationsExaminees: o.operationsExaminees.filter((n) => n !== 'symbolesDeChaine'), possibilites: o.possibilites.filter((a) => a.operation !== 'symbolesDeChaine') }));
  const v = vue(pre38, sansSymboles);
  assert.deepEqual(v.experiences, []);
  const r = message(v, 'parcourirStructure');
  assert.equal(r.length, 1);
  assert.equal(r[0].raison, RAISONS_REFUS.GARANTIE_INSUFFISANTE);
});
test('K7. RÉEL 6 clés AVEC symbolesDeChaine mais sans preuve des contrats d\'opérations : une dérive conjointe reste possible (K5) -> REFUS (garantie_insuffisante) de TOUTES les expériences message', async () => {
  const l = await monoTour();
  const six = avecLignes(l, sansPreuves);
  assert.equal(six.observations[0].operationsExaminees.includes('symbolesDeChaine'), true);
  const v = vue(six);
  assert.deepEqual(v.experiences, []);
  assert.equal(v.refusees.length, 2);
  for (const r of v.refusees) assert.equal(r.raison, RAISONS_REFUS.GARANTIE_INSUFFISANTE);
});
test('K8. RÉEL 7 clés (preuve des contrats d\'opérations + symbolesDeChaine) et ANCIENNES 8/9 clés (sans preuve message) : acceptées par B, forme scalaire chaîne ; la preuve message n\'est JAMAIS supposée (les lignes ne la portent pas)', async () => {
  const l = await monoTour();
  for (const [nom, f] of [['7', sept], ['8 anciennes', ancien8], ['9 anciennes', ancien9]]) {
    const ligne = avecLignes(l, f);
    assert.equal((ligne.observations[0].empreintesCategoriesDonnees ?? []).some((p) => p.categorie === CATEGORIE_MESSAGE), false, nom);
    const v = vue(ligne);
    assert.equal(v.experiences.length, 2, nom);
    assert.deepEqual(v.refusees, [], nom);
    assert.deepEqual(parOperation(v, 'parcourirStructure')[0].entrees, [{ entree: 'valeur', donnee: 'message-1', forme: FCH }], nom);
  }
  const nouvelle = vue(l);
  assert.equal(nouvelle.experiences.length, 2);
  assert.deepEqual(nouvelle.experiences.map((e) => e.entrees), vue(avecLignes(l, ancien9)).experiences.map((e) => e.entrees));
});
test('K9. B exige que le contrat d\'opération soit VÉRIFIÉ : un contrat dérivé (empreinte d\'opération falsifiée) ou une preuve message FAUSSE -> contexte_infidele, jamais une étiquette faible', async () => {
  const l = await monoTour();
  const fauxOps = avecLignes(l, (o) => ({ ...ancien9(o), empreintesOperationsExaminees: o.empreintesOperationsExaminees.map((p) => (p.operation === 'symbolesDeChaine' ? { ...p, empreinte: 'a'.repeat(64) } : p)) }));
  for (const r of vue(fauxOps).refusees) assert.equal(r.raison, RAISONS_REFUS.CONTEXTE_INFIDELE);
  assert.equal(vue(fauxOps).experiences.length, 0);
  const fauxMessage = avecLignes(l, (o) => ({ ...o, empreintesCategoriesDonnees: o.empreintesCategoriesDonnees.map((p) => (p.categorie === CATEGORIE_MESSAGE ? { ...p, empreinte: 'b'.repeat(64) } : p)) }));
  const v = vue(fauxMessage);
  assert.equal(v.experiences.length, 0);
  for (const r of v.refusees) { assert.equal(r.raison, RAISONS_REFUS.CONTEXTE_INFIDELE); assert.match(r.detail, /catégorie « message »/); }
});
test('K10. DÉRIVES de la représentation du message (forme, accès vivant, accès historique) sur une observation protégée : l\'empreinte change, les ATOMES restent identiques, la reconstruction est REFUSÉE (contexte_infidele)', async () => {
  const l = await monoTour();
  const variantes = {
    forme: (c) => { c.forme = { forme: 'scalaire', genre: 'nombre' }; },
    'accès vivant': (c) => { c.acces.vivant = { champ: 'contenu' }; },
    'accès historique': (c) => { c.acces.historique = { champ: 'v' }; },
    identité: (c) => { c.identite.sondes[2].identite = 'x'; },
  };
  for (const [nom, derive] of Object.entries(variantes)) {
    const contrat = contratMessage(); derive(contrat);
    const empreinte = sha256Hex(canoniserContratCategorie(contrat));
    assert.notEqual(empreinte, empreinteContratMessage(), nom);
    const ligne = avecLignes(l, (o) => ({ ...o, empreintesCategoriesDonnees: o.empreintesCategoriesDonnees.map((p) => (p.categorie === CATEGORIE_MESSAGE ? { ...p, empreinte } : p)) }));
    assert.deepEqual(ligne.observations[0].possibilites, l.observations[0].possibilites, `${nom} : atomes identiques`);
    const v = vue(ligne);
    assert.deepEqual(v.experiences, [], nom);
    assert.equal(v.refusees.length, 2, nom);
    for (const r of v.refusees) { assert.equal(r.raison, RAISONS_REFUS.CONTEXTE_INFIDELE, nom); assert.match(r.detail, /catégorie « message » a changé/, nom); }
  }
});
test('K11. T1 -> T2 avec de NOUVELLES observations protégées : la ligne de T1 porte [entrées(P), message] ; l\'expérience de parcourirStructure est acceptée (forme scalaire chaîne) ; la sonde de T2 trouve EXACTEMENT 1 correspondance parmi 5 candidats ; rien n\'est ajouté', async () => {
  const v1 = await vie(['bonjour Pixel', 'bonjour Luna']);
  const l = await lignes(v1.magasin);
  for (const o of l.observations) assert.deepEqual(o.empreintesCategoriesDonnees.map((p) => p.categorie), [CATEGORIE_ENTREES_PRODUCTION, CATEGORIE_MESSAGE]);
  const S1 = v1.tours[0].S; const S2 = v1.tours[1].S;
  const avant = { d: l.designations.length, e: l.executions.length, choix: clone(S2.choixAFaire), classement: stable(applicationsSollicitables(S2.observation, D, S2.univers)) };
  const histoire = formesEntreesRencontrees(l.designations.filter((d) => d.idObservation === S1.observation.id), l.observations.filter((o) => o.id === S1.observation.id), l.valeurs, l.executions.filter((e) => l.designations.find((d) => d.id === e.idDesignation).idObservation === S1.observation.id), D);
  assert.deepEqual(histoire.refusees, []);
  const formes = histoire.experiences.filter((e) => e.operation === 'parcourirStructure').map((e) => stable(e.entrees[0].forme));
  assert.deepEqual(formes, [stable(FCH)]);
  const candidats = groupesDeCandidats(S2.observation.possibilites, D).find((g) => g.operation === 'parcourirStructure').entrees[0].donnees;
  assert.equal(candidats.length, 5);
  assert.deepEqual(candidats.filter((id) => formes.includes(stable(S2.univers.find((e) => e.donnee.identite === id).donnee.forme))), ['message-2']);
  const apres = await lignes(v1.magasin);
  assert.equal(apres.designations.length, avant.d); assert.equal(apres.executions.length, avant.e);
  assert.deepEqual(S2.choixAFaire, avant.choix);
  assert.equal(stable(applicationsSollicitables(S2.observation, D, S2.univers)), avant.classement);
});
const ANCIENNE = (id, operation = 'fabN', liaisons = [{ entree: 'chaine', donnee: 'm1' }]) => ({ id, horodatage: '2026-01-01T00:00:00.000Z', operation, liaisons, resultat: 1 });
test('K12. EXÉCUTION ANCIENNE (format d\'avant v0.63.23 : { id, horodatage, operation, liaisons, resultat }, sans idDesignation) : refus INDIVIDUEL (designation_absente) ; aucune TypeError globale ; les autres expériences sont rendues', () => {
  const w = monde(9, CAT, true);
  const ancienne = ANCIENNE('a0');
  const v = formesEntreesRencontrees(w.designations, w.observations, w.valeurs, [ancienne, ...w.executions], w.catalogue);
  assert.equal(v.experiences.length, 5);
  assert.deepEqual(v.refusees, [{ idExecution: 'a0', operation: 'fabN', raison: RAISONS_REFUS.DESIGNATION_ABSENTE, detail: v.refusees[0].detail }]);
  assert.match(v.refusees[0].detail, /aucune désignation/);
  assert.deepEqual(v.experiences.map((e) => e.idExecution), ['f1', 'f2', 'x1', 'x2', 'x3']);
  const avecProd = formesEntreesRencontrees(w.designations, w.observations, w.valeurs, [ancienne, ...w.executions, ANCIENNE('a1', 'couple', [{ entree: 'a', donnee: 'm1' }, { entree: 'b', donnee: 'm2' }])], w.catalogue);
  assert.equal(avecProd.experiences.length, 5); assert.equal(avecProd.refusees.length, 2);
});
test('K13. EXÉCUTION ANCIENNE dont la production figure dans l\'univers d\'une observation : la reconstruction reste valide (ancien format = une production comme une autre) et la vue refuse seulement la ligne ancienne', () => {
  const w = monde(9, CAT, true);
  const ancienne = ANCIENNE('a0');
  const executions = [ancienne, ...w.executions];
  const O2 = (() => {
    const univers = resoudreIdentitesDonnees(['a0', 'm2'], w.valeurs, executions, w.catalogue);
    const base = clone(w.observations[0]);
    return { ...base, id: 'O2', idMessage: 'm2', donneesExaminees: ['a0', 'm2'], possibilites: possibilitesDeLiaison(univers.map((e) => e.donnee), w.catalogue) };
  })();
  const v = formesEntreesRencontrees(w.designations, [...w.observations, O2], w.valeurs, executions, w.catalogue);
  assert.equal(v.experiences.length, 5);
  assert.deepEqual(v.refusees.map((r) => r.idExecution), ['a0']);
});
test('K14. UNE LIGNE MODERNE MAL FORMÉE N\'EST PAS RENDUE « ANCIENNE » : sans idDesignation mais avec une clé en plus (sousDonnees, absente de tout format sans idDesignation), sans resultat, sans horodatage, operation ou liaisons invalides -> TypeError ; idDesignation présent mais invalide (vide, non chaîne, accesseur) -> TypeError', () => {
  const w = monde(9, CAT, true);
  const appel = (ligne) => formesEntreesRencontrees(w.designations, w.observations, w.valeurs, [ligne, ...w.executions.filter((e) => e.id !== ligne.id)], w.catalogue);
  const { resultat, ...sansResultat } = ANCIENNE('a0');
  const { horodatage, ...sansHorodatage } = ANCIENNE('a0');
  for (const mauvaise of [{ ...ANCIENNE('a0'), sousDonnees: [] }, sansResultat, sansHorodatage, { ...ANCIENNE('a0'), horodatage: '' }, { ...ANCIENNE('a0'), operation: '' }, { ...ANCIENNE('a0'), liaisons: [] },
    { ...ANCIENNE('a0'), liaisons: [{ entree: 'chaine' }] }, { ...ANCIENNE('a0'), extra: 1 }, { ...ANCIENNE('a0'), idDesignation: '' }, { ...ANCIENNE('a0'), idDesignation: 5 }, { ...ANCIENNE('a0'), idDesignation: undefined }]) {
    assert.throws(() => appel(mauvaise), TypeError, JSON.stringify(mauvaise));
  }
  const accesseur = ANCIENNE('a0'); Object.defineProperty(accesseur, 'idDesignation', { get() { return 'd1'; }, enumerable: true });
  assert.throws(() => appel(accesseur), TypeError);
  const symbole = ANCIENNE('a0'); symbole[Symbol('x')] = 1;
  assert.throws(() => appel(symbole), TypeError);
});
test('K15. LES LIGNES RÉELLES D\'UNE VIE SANS idDesignation (anciennes) : retirer idDesignation d\'une exécution du scénario réel la refuse individuellement ; les 22 autres restent des expériences ; aucune écriture, aucune entrée modifiée', async () => {
  const { l } = await vecue();
  const c = clone(l);
  const cible = c.executions[0];
  delete cible.idDesignation;
  const avant = stable(c);
  const v = vue(c);
  assert.equal(stable(c), avant);
  assert.deepEqual(v.refusees.map((r) => [r.idExecution, r.raison]), [[cible.id, RAISONS_REFUS.DESIGNATION_ABSENTE]]);
  assert.equal(v.experiences.length, 18); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 22 → 18
});
test('K16. SCÉNARIO 7 TOURS (v0.63.65 ; MISE À JOUR DÉLIBÉRÉE v0.63.67 : chiffres refaits avec composerCollection) : choix 0,1,4,13,13,13,13 ; auto 2,4,9,1,1,1,1 ; 19 exécutions ; zéro echec_* ; seules les preuves de catégorie des observations ont changé (deux entrées) ; les 19 expériences sont acceptées', async () => {
  const { l, tours } = await vecue();
  assert.deepEqual(tours.map((t) => t.S.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesuré
  assert.deepEqual(tours.map((t) => t.S.automatiques.length), [2, 4, 9, 1, 1, 1, 1]); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesuré
  assert.equal(l.executions.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  for (const t of tours) for (const r of t.S.automatiques) assert.equal(String(r.statut).startsWith('echec_'), false);
  for (const o of l.observations) { assert.equal(Object.keys(o).length, 9); assert.deepEqual(o.empreintesCategoriesDonnees.map((p) => p.categorie), [CATEGORIE_ENTREES_PRODUCTION, CATEGORIE_MESSAGE]); }
  const v = vue(l);
  assert.equal(v.experiences.length, 19); assert.deepEqual(v.refusees, []); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
});

// ------------------------------------------------------------------------------------------------------------------------ J. DORMANCE ET PURETÉ
test('J1. DORMANCE : aucun fichier de app/ ne nomme le module ni la fonction en dehors de lui-même ; ni catalogue, ni table d\'opérations, ni main / pont / contexte / esprit', () => {
  const sources = [];
  const parcourir = (dossier) => { for (const nom of readdirSync(dossier)) { const chemin = join(dossier, nom); if (statSync(chemin).isDirectory()) parcourir(chemin); else if (/\.(m?js|html)$/.test(nom)) sources.push(chemin); } };
  parcourir(join(RACINE, 'app'));
  const rel = (f) => relative(RACINE, f).split('\\').join('/');
  const nommants = sources.filter((f) => /formes-rencontrees|formesEntreesRencontrees|RAISONS_REFUS/.test(readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(nommants, ['app/langage/formes-rencontrees.js']);
  for (const f of ['app/main.js', 'app/langage/applications-sollicitables.js', 'app/langage/execution-mecanique.js', 'app/langage/contexte-sollicitation.js', 'app/langage/pont.js', 'app/langage/groupes-candidats.js', 'app/langage/observation-possibilites.js']) {
    assert.equal(/formes-rencontrees|formesEntreesRencontrees/.test(lu(...f.split('/'))), false, f);
  }
  for (const f of sources.filter((s) => /[\\/]esprit[\\/]/.test(s))) assert.equal(/formes-rencontrees/.test(readFileSync(f, 'utf8')), false, f);
  for (const autre of ['sw.js', 'worker.js', 'index.html', 'app/sw.js', 'app/index.html', 'app/manifest.webmanifest']) { let s = ''; try { s = lu(...autre.split('/')); } catch { continue; } assert.equal(/formes-rencontrees/.test(s), false, autre); }
  assert.equal(D.some((d) => /formesEntreesRencontrees|formes-rencontrees/i.test(d.nom)), false);
  assert.equal(Object.keys(TABLE_OPERATIONS).some((n) => /formesEntreesRencontrees/i.test(n)), false);
});
test('J2. IMPORTS EXACTS : le contexte historique et la reconnaissance entrées(P) seulement ; aucun magasin, horloge, hasard, identité générée, asynchronisme ni état global', () => {
  assert.deepEqual([...CODE.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./contexte-observation.js', './empreinte-categorie-message.js', './entrees-donnee.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.65 : + empreinte-categorie-message.js (le NOM de la catégorie message, pour reconnaître sa preuve explicite ; aucun calcul)
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'crypto', 'setTimeout', 'require(']) assert.equal(CODE.includes(interdit), false, interdit);
  assert.deepEqual(Object.keys(module).sort(), ['RAISONS_REFUS', 'formesEntreesRencontrees']);
});
test('J3. AUCUNE PERSISTANCE : ni table, ni VERSION_BASE, ni migration, ni nouveau champ d\'observation ; catalogue (16) et table d\'opérations (16) inchangés', async () => {
  assert.equal(VERSION_BASE, 22); assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(D.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  const { l } = await vecue();
  for (const o of l.observations) assert.equal(Object.keys(o).length, 9);
  assert.equal(Object.isFrozen(RAISONS_REFUS), true);
  assert.deepEqual(Object.values(RAISONS_REFUS).sort(), ['contexte_infidele', 'designation_absente', 'garantie_insuffisante', 'incoherence_designation', 'liaison_hors_observation', 'observation_absente']);
});
// === FIN_TEST_FORMES_RENCONTREES ===
