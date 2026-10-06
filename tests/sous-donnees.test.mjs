// === DEBUT_TEST_SOUS_DONNEES ===
// v0.63.46 — « α2-LIGNE » (décision ChatGPT, 06/10/2026, après le diagnostic « effet sur les entrées collectives »).
// Les champs OBLIGATOIRES NOMMÉS déclarés au premier niveau d'une sortie objet deviennent des DONNÉES de plein droit (identité opaque chaîne, créée une fois à l'écriture de l'exécution,
// relation portée par la clé optionnelle `sousDonnees` de la ligne), sans devenir des productions ni des exécutions. Preuves : le module pur ; le format et son écriture ; la chaîne réelle
// A,B -> P ; C -> P' ; H, H' ; Q = partagerCouvertures(H', H) -> Q + D1/D2/D3 ; D2 consommable (valeur [[C]]) ; « choix à faire » ; stabilité ; provenance ; anciennes lignes ; collectif
// historique ; cas decrire* ; absence de boucle ; ce qui n'est PAS touché.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { invoquerOperation } from '../app/langage/invocation-operations.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { partagerCouvertures } from '../app/langage/partition-couvertures.js';
import { produireSuitesFermees } from '../app/langage/suites-fermees.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { identifierMessage } from '../app/langage/pont.js';
import {
  magasinMemoireVive, enregistrerObservationPossibilites, enregistrerDesignation, enregistrerExecutionOperation, VERSION_BASE, TABLES,
} from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import {
  sousDonneesDeclarees, formeSousDonnee, sousValeurConforme, valeurSousDonnee, sousDonneesCanoniques, preparerSousDonnees, indexSousDonnees,
} from '../app/langage/sous-donnees.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...parties) => readFileSync(join(RACINE, ...parties), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const SRC = lu('app', 'langage', 'sous-donnees.js');
const CODE = sansCommentaires(SRC);
const desc = (nom) => DESCRIPTIONS_OPERATIONS.find((d) => d.nom === nom);
const ids = (n = 'sd') => { let k = 0; return (p) => `${p}-${n}-${++k}`; };

// ============================================================================ A. LE MODULE PUR
test('A1. sous-données exposables : champs nommés OBLIGATOIRES du premier niveau d\'une sortie objet, triés par unités de code ; sortie non objet : aucune', () => {
  const noms = (op) => sousDonneesDeclarees(desc(op).sortie).map((s) => s.chemin);
  assert.deepEqual(noms('partagerCouvertures'), [['communs'], ['seulementA'], ['seulementB']]);
  assert.deepEqual(noms('decrireStructureIdentifiee'), [['couverture'], ['rapport']]);
  assert.deepEqual(noms('decrireValeursObservees'), [['ambigus'], ['nombreValeurs'], ['nonResolus'], ['valeurs']]);
  const objets = DESCRIPTIONS_OPERATIONS.filter((d) => d.sortie.forme === 'objet').map((d) => d.nom).sort();
  assert.deepEqual(objets, ['decrireStructureIdentifiee', 'decrireValeursObservees', 'partagerCouvertures']);
  for (const d of DESCRIPTIONS_OPERATIONS) if (d.sortie.forme !== 'objet') assert.deepEqual(sousDonneesDeclarees(d.sortie), [], d.nom);
  // un champ `peutManquer` n'est JAMAIS exposé ; un objet sans champs ne porte rien
  const sortie = { forme: 'objet', champs: { b: { forme: 'scalaire' }, a: { forme: 'scalaire', peutManquer: true }, c: { forme: 'collection' } } };
  assert.deepEqual(sousDonneesDeclarees(sortie).map((s) => s.chemin), [['b'], ['c']]);
  assert.deepEqual(sousDonneesDeclarees({ forme: 'objet' }), []);
  assert.deepEqual(sousDonneesDeclarees({ forme: 'collection', elements: { forme: 'objet', champs: { x: { forme: 'scalaire' } } } }), [], 'jamais les éléments de collection');
});
test('A2. la sous-forme se lit dans le descripteur COURANT (copie neuve) ; un chemin non exposable rend null ; la forme n\'est jamais persistée', () => {
  const f = formeSousDonnee(desc('partagerCouvertures').sortie, ['seulementA']);
  assert.deepEqual(f, { forme: 'collection', elements: { forme: 'collection', elements: { forme: 'scalaire' } } });
  assert.notEqual(f, desc('partagerCouvertures').sortie.champs.seulementA);
  assert.notEqual(f.elements, desc('partagerCouvertures').sortie.champs.seulementA.elements);
  assert.equal(formeSousDonnee(desc('partagerCouvertures').sortie, ['inconnu']), null);
  assert.equal(formeSousDonnee(desc('elementsObservables').sortie, ['x']), null);
});
test('A3. conformité valeur / forme : scalaire (genre), collection dense, objet (champs obligatoires, extras tolérés), quelconque ; null seulement si peutEtreNull ; undefined refusé', () => {
  const ok = (v, f) => assert.doesNotThrow(() => sousValeurConforme(v, f, 'x'));
  const ko = (v, f) => assert.throws(() => sousValeurConforme(v, f, 'x'), TypeError);
  ok('a', { forme: 'scalaire', genre: 'chaine' }); ko(1, { forme: 'scalaire', genre: 'chaine' });
  ok(1, { forme: 'scalaire', genre: 'nombre' }); ko(Number.NaN, { forme: 'scalaire', genre: 'nombre' });
  ok(true, { forme: 'scalaire', genre: 'booleen' }); ko('x', { forme: 'scalaire', genre: 'booleen' });
  ok('a', { forme: 'scalaire' }); ko({}, { forme: 'scalaire' });
  ok([['a']], { forme: 'collection', elements: { forme: 'collection', elements: { forme: 'scalaire' } } });
  ko([[{}]], { forme: 'collection', elements: { forme: 'collection', elements: { forme: 'scalaire' } } });
  ko('a', { forme: 'collection' }); ko([, 1], { forme: 'collection' });
  ok({ a: 1, extra: 2 }, { forme: 'objet', champs: { a: { forme: 'scalaire' } } }); ko({}, { forme: 'objet', champs: { a: { forme: 'scalaire' } } });
  ok({}, { forme: 'objet', champs: { a: { forme: 'scalaire', peutManquer: true } } }); ko([], { forme: 'objet' });
  ok(7, { forme: 'quelconque' });
  ko(null, { forme: 'scalaire' }); ok(null, { forme: 'scalaire', peutEtreNull: true }); ko(undefined, { forme: 'quelconque' });
  ko({ a: undefined }, { forme: 'objet', champs: { a: { forme: 'scalaire' } } });
  assert.throws(() => sousValeurConforme(Object.defineProperty({}, 'a', { get: () => 1, enumerable: true }), { forme: 'objet', champs: { a: { forme: 'scalaire' } } }, 'x'), TypeError, 'accesseur refusé sans être exécuté');
});
test('A4. format canonique : tableau non vide, clés closes { id, chemin }, un segment, ids et chemins uniques, id ≠ id d\'exécution, ordre par chemin ; COPIE neuve', () => {
  const bon = [{ id: 'i2', chemin: ['b'] }, { id: 'i1', chemin: ['c'] }];
  assert.deepEqual(sousDonneesCanoniques([{ id: 'i1', chemin: ['a'] }, { id: 'i2', chemin: ['b'] }], 'sd', 'X'), [{ id: 'i1', chemin: ['a'] }, { id: 'i2', chemin: ['b'] }]);
  const copie = sousDonneesCanoniques(bon, 'sd', 'X');
  assert.deepEqual(copie, bon); assert.notEqual(copie, bon); assert.notEqual(copie[0], bon[0]); assert.notEqual(copie[0].chemin, bon[0].chemin);
  const refus = (brut, motif) => assert.throws(() => sousDonneesCanoniques(brut, 'sd', 'X'), TypeError, motif);
  refus([], 'vide interdit'); refus('x', 'pas un tableau'); refus({}, 'pas un tableau');
  refus([{ id: 'i', chemin: ['a'], x: 1 }], 'clé étrangère'); refus([{ id: 'i' }], 'chemin absent'); refus([{ chemin: ['a'] }], 'id absent');
  refus([{ id: '', chemin: ['a'] }], 'id vide'); refus([{ id: 1, chemin: ['a'] }], 'id non chaîne'); refus([{ id: 'X', chemin: ['a'] }], 'id = id de l\'exécution');
  refus([{ id: 'i', chemin: 'a' }], 'chemin encodé en chaîne'); refus([{ id: 'i', chemin: [] }], 'chemin vide'); refus([{ id: 'i', chemin: ['a', 'b'] }], 'deux segments');
  refus([{ id: 'i', chemin: [''] }], 'segment vide'); refus([{ id: 'i', chemin: [1] }], 'segment non chaîne'); refus([{ id: 'i', chemin: [, 'a'] }], 'chemin creux');
  refus([{ id: 'i', chemin: ['a'] }, { id: 'i', chemin: ['b'] }], 'id dupliqué'); refus([{ id: 'i', chemin: ['a'] }, { id: 'j', chemin: ['a'] }], 'chemin dupliqué');
  refus([{ id: 'i', chemin: ['b'] }, { id: 'j', chemin: ['a'] }], 'ordre non canonique'); refus([, { id: 'j', chemin: ['a'] }], 'tableau creux');
  refus([Object.defineProperty({ chemin: ['a'] }, 'id', { get: () => 'i', enumerable: true })], 'accesseur');
});
test('A5. preparerSousDonnees (côté appelant) : opération non décrite, sortie non objet ou sans champ exposable -> undefined ; Q -> 3 relations opaques, triées, ids distincts créés UNE fois', () => {
  const Q = { communs: [['a'], ['b']], seulementA: [['c']], seulementB: [] };
  assert.equal(preparerSousDonnees(DESCRIPTIONS_OPERATIONS, 'inconnue', Q, ids()), undefined);
  assert.equal(preparerSousDonnees(DESCRIPTIONS_OPERATIONS, 'elementsObservables', [{ chemin: ['a'], contenu: ['x'] }], ids()), undefined);
  assert.equal(preparerSousDonnees([{ nom: 'o', entrees: {}, sortie: { forme: 'objet' } }], 'o', {}, ids()), undefined);
  let appels = 0;
  const gen = (p) => { appels += 1; return `${p}-${appels}-${Math.random().toString(36).slice(2)}`; };
  const r = preparerSousDonnees(DESCRIPTIONS_OPERATIONS, 'partagerCouvertures', Q, gen);
  assert.equal(appels, 3);
  assert.deepEqual(r.map((x) => x.chemin), [['communs'], ['seulementA'], ['seulementB']]);
  assert.equal(new Set(r.map((x) => x.id)).size, 3);
  for (const x of r) { assert.equal(typeof x.id, 'string'); assert.ok(x.id.length > 0); assert.equal(/communs|seulement|chemin/.test(x.id), false, 'ni nom de champ ni chemin dans l\'identité'); assert.deepEqual(Object.keys(x), ['id', 'chemin']); }
  assert.deepEqual(sousDonneesCanoniques(r, 'sd'), r, 'directement écrivable');
});
test('A6. preparerSousDonnees : un champ obligatoire absent, non conforme, accesseur ou valeur non objet REFUSE tout (aucune sous-donnée partielle)', () => {
  const Q = { communs: [], seulementA: [['c']], seulementB: [] };
  const refus = (valeur) => assert.throws(() => preparerSousDonnees(DESCRIPTIONS_OPERATIONS, 'partagerCouvertures', valeur, ids()), TypeError);
  refus({ communs: [], seulementA: [['c']] }); // seulementB absent
  refus({ ...Q, seulementB: 'x' }); refus({ ...Q, seulementA: [['c', {}]] }); refus({ ...Q, communs: undefined }); refus({ ...Q, communs: null });
  refus(Object.defineProperty({ communs: [], seulementB: [] }, 'seulementA', { get: () => [], enumerable: true }));
  refus([]); refus(null); refus('x');
  assert.throws(() => preparerSousDonnees(DESCRIPTIONS_OPERATIONS, 'partagerCouvertures', Q, 'pas une fonction'), TypeError);
  assert.throws(() => preparerSousDonnees('x', 'partagerCouvertures', Q, ids()), TypeError);
});
test('A7. valeurSousDonnee rend la RÉFÉRENCE du champ propre (jamais une copie) ; absent ou accesseur : TypeError', () => {
  const sous = [['c']]; const v = { seulementA: sous };
  assert.equal(valeurSousDonnee(v, ['seulementA']), sous);
  assert.throws(() => valeurSousDonnee(v, ['absent']), TypeError);
  assert.throws(() => valeurSousDonnee(Object.defineProperty({}, 'x', { get: () => 1 }), ['x']), TypeError);
  assert.throws(() => valeurSousDonnee([], ['x']), TypeError);
});

// ============================================================================ B. ÉCRITURE DE LA LIGNE
const designation = (operation = 'partagerCouvertures') => ({ id: 'designation-x', operation, liaisons: [{ entree: 'a', donnee: 'd1' }, { entree: 'b', donnee: 'd2' }] });
const entreeExec = (extra = {}, resultat = { communs: [], seulementA: [['c']], seulementB: [] }) => ({ designation: designation(), operation: 'partagerCouvertures', liaisons: designation().liaisons, resultat, ...extra });
test('B1. écriture : la clé `sousDonnees` n\'est écrite que si elle est fournie ; sans elle la ligne a exactement les clés de v0.63.45', async () => {
  const m1 = magasinMemoireVive();
  const sans = await enregistrerExecutionOperation(m1, entreeExec());
  assert.deepEqual(Object.keys(sans).sort(), ['horodatage', 'id', 'idDesignation', 'liaisons', 'operation', 'resultat']);
  const m2 = magasinMemoireVive();
  const rel = [{ id: 'sd-1', chemin: ['communs'] }, { id: 'sd-2', chemin: ['seulementA'] }, { id: 'sd-3', chemin: ['seulementB'] }];
  const avec = await enregistrerExecutionOperation(m2, entreeExec({ sousDonnees: rel }));
  assert.deepEqual(Object.keys(avec).sort(), ['horodatage', 'id', 'idDesignation', 'liaisons', 'operation', 'resultat', 'sousDonnees']);
  assert.deepEqual(avec.sousDonnees, rel); assert.notEqual(avec.sousDonnees, rel);
  assert.deepEqual(avec.resultat, { communs: [], seulementA: [['c']], seulementB: [] }, 'la production entière est inchangée');
  assert.deepEqual(await m2.lireTout('executionsOperations'), [avec]);
});
test('B2. écriture : tout refus laisse la table VIDE (tout ou rien) — vide, clé étrangère, doublons, ordre, id = id d\'exécution impossible à deviner, champ absent du résultat, résultat non objet', async () => {
  const refus = async (extra, resultat) => {
    const m = magasinMemoireVive();
    await assert.rejects(enregistrerExecutionOperation(m, entreeExec(extra, resultat)), TypeError);
    assert.deepEqual(await m.lireTout('executionsOperations'), []);
  };
  await refus({ sousDonnees: [] });
  await refus({ sousDonnees: undefined });
  await refus({ sousDonnees: [{ id: 'a', chemin: ['communs'], x: 1 }] });
  await refus({ sousDonnees: [{ id: 'a', chemin: ['communs'] }, { id: 'a', chemin: ['seulementA'] }] });
  await refus({ sousDonnees: [{ id: 'a', chemin: ['seulementA'] }, { id: 'b', chemin: ['communs'] }] });
  await refus({ sousDonnees: [{ id: 'a', chemin: ['absent'] }] });
  await refus({ sousDonnees: [{ id: 'a', chemin: ['communs'] }] }, [1, 2]);
  await refus({ sousDonnees: [{ id: 'a', chemin: ['communs'] }] }, 'texte');
  const m = magasinMemoireVive();
  await assert.rejects(enregistrerExecutionOperation(m, { ...entreeExec(), autre: 1 }), TypeError, 'clés d\'entrée toujours closes');
});

// ============================================================================ C. LA CHAÎNE RÉELLE
function monde() {
  const magasin = magasinMemoireVive();
  let n = 0;
  async function tour(texte) {
    let k = (n += 1) * 100;
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    const r = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
    assert.equal(r.statut, 'ecrite');
    return { message, observation: r.observation, univers: r.univers };
  }
  async function lancer(texteTour, operation, liaisons) {
    const t = await tour(texteTour);
    const application = liaisons ? { operation, liaisons } : applicationsSollicitables(t.observation, undefined, t.univers).applications.find((a) => a.operation === operation);
    assert.ok(application, `${operation} : application attendue`);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
    assert.equal(r.statut, 'executee', `${operation} : ${r.erreur && r.erreur.message}`);
    return { ...r, t };
  }
  return { magasin, tour, lancer };
}
async function construire() {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const C = await w.lancer('bonsoir Pixel', 'symbolesDeChaine');
  const Pp = await w.lancer("tour P'", 'elementsObservables');
  const id = { A: A.execution.id, B: B.execution.id, C: C.execution.id, P: P.execution.id, Pp: Pp.execution.id };
  const H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: id.P }]);
  const Hp = await w.lancer("tour H'", 'projeterChemins', [{ entree: 'elements', donnee: id.Pp }]);
  const Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: Hp.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  return { w, A, B, C, P, Pp, H, Hp, Q, id };
}
const MEMO = await construire();
const DONNEES = ['communs', 'seulementA', 'seulementB'];
const sdDe = (ligne) => Object.fromEntries(ligne.sousDonnees.map((r) => [r.chemin[0], r.id]));

test('C1. Q reste la production ENTIÈRE et porte trois sous-données D1/D2/D3 (relations canoniques, ids opaques et distincts) ; aucune autre ligne ne porte `sousDonnees`', async () => {
  const { w, Q, id } = MEMO;
  const lignes = await w.magasin.lireTout('executionsOperations');
  const ligneQ = lignes.find((l) => l.id === Q.execution.id);
  assert.deepEqual(ligneQ.resultat, { communs: [[id.A], [id.B]], seulementA: [[id.C]], seulementB: [] });
  assert.deepEqual(ligneQ.sousDonnees.map((r) => r.chemin), [['communs'], ['seulementA'], ['seulementB']]);
  assert.equal(new Set(ligneQ.sousDonnees.map((r) => r.id)).size, 3);
  assert.equal(ligneQ.sousDonnees.some((r) => r.id === ligneQ.id), false);
  for (const r of ligneQ.sousDonnees) assert.equal(/communs|seulement|execution-operation/.test(r.id), false, 'identité non sémantique');
  assert.deepEqual(lignes.filter((l) => Object.hasOwn(l, 'sousDonnees')).map((l) => l.id), [ligneQ.id], 'seul Q (seule sortie objet exécutée) porte des sous-données');
  assert.deepEqual(Object.keys(ligneQ).sort(), ['horodatage', 'id', 'idDesignation', 'liaisons', 'operation', 'resultat', 'sousDonnees']);
  assert.equal(lignes.length, 8, 'A, B, P, C, P\', H, H\', Q');
});
test('C2. la photographie du tour SUIVANT : Q + D1, D2, D3 sont des données ordinaires ; D1/D2/D3 ont la MÊME forme déclarée et le même statut de candidate', async () => {
  const { w, Q, id } = MEMO;
  const t = await w.tour('tour après Q');
  const lignes = await w.magasin.lireTout('executionsOperations');
  const sd = sdDe(lignes.find((l) => l.id === Q.execution.id));
  const examinees = t.observation.donneesExaminees;
  for (const d of [Q.execution.id, ...Object.values(sd)]) assert.ok(examinees.includes(d), d);
  assert.equal(examinees.length, 1 + 8 + 3 + 8, 'message + 8 productions + 3 sous-données + 8 entrées(P) (une par EXÉCUTION, aucune pour les sous-données)'); // MISE À JOUR DÉLIBÉRÉE v0.63.59
  for (const d of Object.values(sd)) assert.equal(examinees.includes(`entrees-de-production:${d}`), false, 'aucune entrées(sous-donnée)');
  assert.equal(examinees.includes(`entrees-de-production:${Q.execution.id}`), true, 'entrées(Q) présente exactement une fois');
  assert.equal(examinees.filter((d) => d === `entrees-de-production:${Q.execution.id}`).length, 1);
  const productions = productionsDecrites(lignes, DESCRIPTIONS_OPERATIONS);
  const forme = (i) => productions.find((p) => p.identite === i).forme;
  assert.deepEqual(forme(sd.communs), { forme: 'collection', elements: { forme: 'collection', elements: { forme: 'scalaire' } } });
  assert.deepEqual(forme(sd.seulementA), forme(sd.communs)); assert.deepEqual(forme(sd.seulementB), forme(sd.communs));
  assert.equal(forme(Q.execution.id).forme, 'objet', 'la production entière garde sa forme objet');
  const entrees = (donnee) => t.observation.possibilites.filter((p) => p.donnee === donnee).map((p) => `${p.operation}.${p.entree}`).sort();
  assert.deepEqual(entrees(sd.communs), entrees(sd.seulementA)); assert.deepEqual(entrees(sd.communs), entrees(sd.seulementB));
  assert.ok(entrees(sd.seulementA).length > 0);
  assert.equal(entrees(Q.execution.id).length, 1, 'Q entière : seulement parcourirStructure.valeur (sortie objet), comme avant');
  assert.equal(id.A.length > 0, true);
});
test('C3. « choix à faire » : pour partagerCouvertures.a, D1, D2, D3 sont TROIS candidats distincts (parmi d\'autres) ; aucune application déterminée, aucun ordre ne choisit', async () => {
  const { w, Q } = MEMO;
  const t = await w.tour('tour choix');
  const lignes = await w.magasin.lireTout('executionsOperations');
  const sd = sdDe(lignes.find((l) => l.id === Q.execution.id));
  for (const entree of ['a', 'b']) {
    const candidats = new Set(t.observation.possibilites.filter((p) => p.operation === 'partagerCouvertures' && p.entree === entree).map((p) => p.donnee));
    for (const d of Object.values(sd)) assert.ok(candidats.has(d), `${entree} : ${d}`);
    assert.ok(candidats.size >= 5, 'H, H\', M… et trois sous-données');
  }
  const app = applicationsSollicitables(t.observation, undefined, t.univers).applications;
  assert.equal(app.some((a) => a.operation === 'partagerCouvertures'), false, 'aucune application déterminée automatiquement');
});
test('C4. PREUVE D2 → [[C]] : une désignation extérieure de D2 fournit EXACTEMENT [[C]] (même référence que le résultat de Q) à partagerCouvertures', async () => {
  const { w, Q, id } = await construire(); // monde neuf : cette preuve ÉCRIT une exécution de plus
  const lignes0 = await w.magasin.lireTout('executionsOperations');
  const sd = sdDe(lignes0.find((l) => l.id === Q.execution.id));
  const t = await w.tour('tour consommation');
  const el = t.univers.find((e) => e.donnee.identite === sd.seulementA);
  assert.deepEqual(Object.keys(el.porteur).sort(), ['id', 'resultat'], 'porteur synthétique { id, resultat }');
  assert.equal(el.porteur.id, sd.seulementA);
  const ligneQ = (await w.magasin.lireTout('executionsOperations')).find((l) => l.id === Q.execution.id);
  assert.equal(valeurDePorteur(el.porteur, el.donnee, el.acces), ligneQ.resultat.seulementA, 'sous-valeur réelle PAR RÉFÉRENCE, sans copie');
  assert.deepEqual(valeurDePorteur(el.porteur, el.donnee, el.acces), [[id.C]]);
  assert.deepEqual(el.acces, { champ: 'resultat' }, 'ACCES_TRACE inchangé');
  const r = await executerApplicationSollicitee({ observation: t.observation, application: { operation: 'partagerCouvertures', liaisons: [{ entree: 'a', donnee: sd.seulementA }, { entree: 'b', donnee: sd.communs }] }, univers: t.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS });
  assert.equal(r.statut, 'executee', r.erreur && r.erreur.message);
  assert.deepEqual(r.execution.resultat, partagerCouvertures([[id.C]], [[id.A], [id.B]]));
  assert.deepEqual(r.execution.resultat, { communs: [], seulementA: [[id.C]], seulementB: [[id.A], [id.B]] });
  assert.equal(r.designation.liaisons.some((l) => l.donnee === sd.seulementA), true, 'la liaison persistée porte l\'identité normale D2');
});
test('C5. STABILITÉ : plusieurs observations successives rendent les MÊMES identités ; aucune écriture dans executionsOperations ; la ligne Q est inchangée', async () => {
  const { w, Q } = MEMO;
  const avant = JSON.stringify(await w.magasin.lireTout('executionsOperations'));
  const lig = (await w.magasin.lireTout('executionsOperations')).find((l) => l.id === Q.execution.id);
  const sd0 = sdDe(lig);
  for (let i = 0; i < 3; i += 1) {
    const t = await w.tour(`tour stabilité ${i}`);
    for (const d of Object.values(sd0)) assert.ok(t.observation.donneesExaminees.includes(d));
    assert.equal(t.observation.donneesExaminees.filter((d) => d.startsWith('sous-donnee-')).length >= 3, true);
  }
  assert.equal(JSON.stringify(await w.magasin.lireTout('executionsOperations')), avant);
  assert.deepEqual(sdDe((await w.magasin.lireTout('executionsOperations')).find((l) => l.id === Q.execution.id)), sd0);
});
test('C6. PROVENANCE D2 → Q → H\', H → P\', P → [A,B,C] / [A,B] : la relation est STRUCTURELLE (index de lecture), aucune fausse exécution ni désignation', async () => {
  const { w, Q, H, Hp, P, Pp, id } = MEMO;
  const lignes = await w.magasin.lireTout('executionsOperations');
  const ligneQ = lignes.find((l) => l.id === Q.execution.id);
  const sd = sdDe(ligneQ);
  const index = indexSousDonnees(lignes);
  assert.equal(index.size, 3);
  const porteuse = index.get(sd.seulementA);
  assert.equal(porteuse.execution, ligneQ); assert.deepEqual(porteuse.chemin, ['seulementA']);
  assert.deepEqual(porteuse.execution.liaisons, [{ entree: 'a', donnee: Hp.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  const parId = new Map(lignes.map((l) => [l.id, l]));
  assert.deepEqual(parId.get(Hp.execution.id).liaisons, [{ entree: 'elements', donnee: Pp.execution.id }]);
  assert.deepEqual(parId.get(H.execution.id).liaisons, [{ entree: 'elements', donnee: P.execution.id }]);
  assert.deepEqual(parId.get(Pp.execution.id).resultat.map((e) => e.chemin[0]), [id.A, id.B, id.C]);
  for (const d of Object.values(sd)) assert.equal(parId.has(d), false, 'une sous-donnée n\'est PAS une exécution');
  const designations = await w.magasin.lireTout('designations');
  assert.equal(designations.some((x) => Object.values(sd).includes(x.id)), false);
  assert.equal(lignes.length, 8, 'aucune ligne en plus');
});

// ============================================================================ D. ANCIENNES LIGNES
test('D1. une ligne valide SANS `sousDonnees` (v0.63.45) se comporte exactement comme avant : production entière seule, aucune sous-donnée rétroactive, aucun resultat lu', () => {
  const ancienne = { id: 'ex-1', horodatage: 'h', idDesignation: 'd', operation: 'partagerCouvertures', liaisons: [{ entree: 'a', donnee: 'x' }], resultat: { communs: [], seulementA: [], seulementB: [] } };
  const avecAccesseur = { id: 'ex-2', operation: 'partagerCouvertures' };
  Object.defineProperty(avecAccesseur, 'resultat', { get() { throw new Error('resultat lu !'); }, enumerable: true });
  const P = productionsDecrites([ancienne, avecAccesseur], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(P.map((p) => p.identite), ['ex-1', 'ex-2']);
  assert.equal(indexSousDonnees([ancienne]).size, 0);
});
test('D2. une ligne dont l\'opération n\'est plus décrite n\'expose rien (même les sous-données) mais son format est VALIDÉ ; un chemin plus exposable n\'expose que les autres', () => {
  const l = { id: 'ex-1', operation: 'disparue', sousDonnees: [{ id: 's-1', chemin: ['x'] }] };
  assert.deepEqual(productionsDecrites([l], DESCRIPTIONS_OPERATIONS), []);
  assert.throws(() => productionsDecrites([{ id: 'ex-1', operation: 'disparue', sousDonnees: [] }], DESCRIPTIONS_OPERATIONS), TypeError);
  const m = { id: 'ex-2', operation: 'partagerCouvertures', sousDonnees: [{ id: 's-1', chemin: ['communs'] }, { id: 's-2', chemin: ['vieuxChamp'] }] };
  assert.deepEqual(productionsDecrites([m], DESCRIPTIONS_OPERATIONS).map((p) => p.identite).sort(), ['ex-2', 's-1']);
});
test('D3. unicité : une identité de sous-donnée égale à une autre identité de l\'ensemble (exécution ou sous-donnée) est REFUSÉE, jamais fusionnée', () => {
  const a = { id: 'ex-1', operation: 'partagerCouvertures', sousDonnees: [{ id: 's-1', chemin: ['communs'] }] };
  assert.throws(() => productionsDecrites([a, { id: 's-1', operation: 'symbolesDeChaine' }], DESCRIPTIONS_OPERATIONS), TypeError);
  assert.throws(() => productionsDecrites([{ id: 's-1', operation: 'symbolesDeChaine' }, a], DESCRIPTIONS_OPERATIONS), TypeError);
  assert.throws(() => productionsDecrites([a, { id: 'ex-2', operation: 'partagerCouvertures', sousDonnees: [{ id: 's-1', chemin: ['communs'] }] }], DESCRIPTIONS_OPERATIONS), TypeError);
  assert.throws(() => indexSousDonnees([a, { id: 'ex-2', operation: 'partagerCouvertures', sousDonnees: [{ id: 's-1', chemin: ['communs'] }] }]), TypeError);
});
test('D4. une sous-valeur ILLISIBLE dans une ligne persistée : l\'observation ne s\'écrit pas (échec_executions), jamais une donnée candidate sans valeur', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('executionsOperations', { id: 'ex-1', operation: 'partagerCouvertures', resultat: { communs: [] }, sousDonnees: [{ id: 's-1', chemin: ['communs'] }, { id: 's-2', chemin: ['seulementA'] }] });
  const message = identifierMessage('x', { nouvelId: (p) => `${p}-1` });
  const r = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
  assert.equal(r.statut, 'echec_executions');
  assert.equal(r.observation, null);
  assert.deepEqual(await magasin.lireTout('observationsPossibilites'), []);
});

// ============================================================================ E. VALIDATION AVANT ÉCRITURE (APPELANT)
test('E1. une opération qui prétend une forme qu\'elle ne respecte pas : exécution REFUSÉE (echec_execution), AUCUNE ligne executionsOperations, désignation conservée', async () => {
  const m = await construire();
  const fausse = { ...TABLE_OPERATIONS, partagerCouvertures: Object.freeze({ ...TABLE_OPERATIONS.partagerCouvertures, fonction: () => ({ communs: [['x']], seulementA: [['y']] }) }) };
  const t = await m.w.tour('tour E1');
  const app = { operation: 'partagerCouvertures', liaisons: [{ entree: 'a', donnee: m.Hp.execution.id }, { entree: 'b', donnee: m.H.execution.id }] };
  const avant = (await m.w.magasin.lireTout('executionsOperations')).length;
  const desAvant = (await m.w.magasin.lireTout('designations')).length;
  const r = await executerApplicationSollicitee({ observation: t.observation, application: app, univers: t.univers }, { magasin: m.w.magasin, table: fausse });
  assert.equal(r.statut, 'echec_execution');
  assert.ok(r.erreur instanceof TypeError);
  assert.equal(r.execution, null);
  assert.equal((await m.w.magasin.lireTout('executionsOperations')).length, avant, 'aucune ligne');
  assert.equal((await m.w.magasin.lireTout('designations')).length, desAvant + 1, 'la désignation déjà persistée reste');
  // une opération sans sous-donnée n'est pas concernée : une valeur « fausse » d'une sortie non objet suit le comportement d'avant (déclaration, non vérification)
  const faussePasObjet = { ...TABLE_OPERATIONS, projeterChemins: Object.freeze({ ...TABLE_OPERATIONS.projeterChemins, fonction: () => ['pas', 'une', 'couverture'] }) };
  const t2 = await m.w.tour('tour E1b');
  const r2 = await executerApplicationSollicitee({ observation: t2.observation, application: { operation: 'projeterChemins', liaisons: [{ entree: 'elements', donnee: m.P.execution.id }] }, univers: t2.univers }, { magasin: m.w.magasin, table: faussePasObjet });
  assert.equal(r2.statut, 'executee');
  assert.equal(Object.hasOwn(r2.execution, 'sousDonnees'), false);
});

// ============================================================================ F. COLLECTIFS
// Une ligne decrire* est fabriquée en PERSISTANCE (aucune production du catalogue ne peut alimenter leurs entrées : voir G1) avec de VRAIES valeurs de l'opération.
async function ajouterDecrire(magasin, operation, entree, valeurs) {
  const resultat = invoquerOperation(TABLE_OPERATIONS, operation, { [entree]: valeurs });
  const des = { id: `designation-${operation}`, operation, liaisons: [{ entree, donnee: 'source-x' }] };
  const relations = preparerSousDonnees(DESCRIPTIONS_OPERATIONS, operation, resultat, ids(operation));
  return enregistrerExecutionOperation(magasin, { designation: des, operation, liaisons: des.liaisons, resultat, sousDonnees: relations });
}
const compatiblesElements = (t) => t.observation.possibilites.filter((p) => p.operation === 'elementsObservables' && p.entree === 'elements').map((p) => p.donnee);
const appCollective = (donnees) => ({ operation: 'elementsObservables', liaisons: [{ entree: 'elements', donnees: [...donnees].sort() }] });

test('F1. les vraies sorties de decrire* sont CONFORMES à leurs sous-formes déclarées (validation à l\'écriture réussie)', async () => {
  const m = magasinMemoireVive();
  const a = await ajouterDecrire(m, 'decrireStructureIdentifiee', 'elements', [{ id: 'a', texte: 'bon' }, { id: 'b', texte: 'bol' }]);
  assert.deepEqual(a.sousDonnees.map((r) => r.chemin), [['couverture'], ['rapport']]);
  const b = await ajouterDecrire(m, 'decrireValeursObservees', 'paires', [{ id: 'a', valeur: 'x' }, { id: 'b', valeur: 'x' }, { id: 'c' }]);
  assert.deepEqual(b.sousDonnees.map((r) => r.chemin), [['ambigus'], ['nombreValeurs'], ['nonResolus'], ['valeurs']]);
});
test('F2. COLLECTIF : une sous-donnée collection de chaînes (decrire*) devient candidate NORMALEMENT de elementsObservables.elements, dès le tour suivant ; ancienne observation inchangée ; nouvelle liaison collective = ensemble EXACT, sous-données comprises', async () => {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const t1 = await w.tour('tour 1');
  const avantObs = JSON.stringify(t1.observation);
  assert.deepEqual(compatiblesElements(t1).sort(), [A.execution.id, B.execution.id].sort(), 'avant : seules les productions symbolisées');
  const dsi = await ajouterDecrire(w.magasin, 'decrireStructureIdentifiee', 'elements', [{ id: 'a', texte: 'bon' }, { id: 'b', texte: 'bol' }]);
  const dvo = await ajouterDecrire(w.magasin, 'decrireValeursObservees', 'paires', [{ id: 'a', valeur: 'x' }, { id: 'c' }]);
  const sd = (l) => Object.fromEntries(l.sousDonnees.map((r) => [r.chemin[0], r.id]));
  const attendus = [A.execution.id, B.execution.id, sd(dsi).couverture, sd(dvo).ambigus, sd(dvo).nonResolus].sort();
  const t2 = await w.tour('tour 2');
  assert.deepEqual(compatiblesElements(t2).sort(), attendus, 'trois sous-données [S:chaîne] rejoignent l\'ensemble exact (aucune exclusion « dérivée »)');
  assert.equal(JSON.stringify(t1.observation), avantObs, 'l\'ancienne observation ne change pas');
  assert.equal(JSON.stringify((await w.magasin.lireTout('observationsPossibilites')).find((o) => o.id === t1.observation.id)), avantObs, 'ni la ligne persistée');
  // la sous-donnée n'est PAS exclue : l'application collective déterminée l'inclut ; l'ensemble partiel est refusé
  const app = applicationsSollicitables(t2.observation, undefined, t2.univers).applications.find((a) => a.operation === 'elementsObservables');
  assert.deepEqual(app.liaisons[0].donnees, attendus);
  await assert.rejects(enregistrerDesignation(w.magasin, { observation: t2.observation, application: appCollective([A.execution.id, B.execution.id]), origine: 'exterieure' }), TypeError, 'ensemble partiel refusé');
  const r = await executerApplicationSollicitee({ observation: t2.observation, application: app, univers: t2.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS });
  assert.equal(r.statut, 'executee', r.erreur && r.erreur.message);
  const P2 = r.execution.resultat;
  assert.deepEqual(P2.map((e) => e.chemin[0]).sort(), attendus);
  assert.deepEqual(P2.find((e) => e.chemin[0] === sd(dsi).couverture).contenu, ['a', 'b'], 'valeur réelle de la sous-donnée');
  assert.deepEqual(P2.find((e) => e.chemin[0] === sd(dvo).ambigus).contenu, []);
  // produireSuitesFermees continue de fonctionner sur ce P enrichi (changement de QUANTITÉ, pas de forme)
  const S = produireSuitesFermees(P2);
  assert.ok(Array.isArray(S) && S.length >= 1);
  assert.equal(fournieGarantitAttendue(desc('elementsObservables').sortie, desc('produireSuitesFermees').entrees.elements), true);
  const t3 = await w.tour('tour 3');
  const appS = { operation: 'produireSuitesFermees', liaisons: [{ entree: 'elements', donnee: r.execution.id }] };
  const rs = await executerApplicationSollicitee({ observation: t3.observation, application: appS, univers: t3.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS });
  assert.equal(rs.statut, 'executee', rs.erreur && rs.erreur.message);
  assert.deepEqual(rs.execution.resultat, S);
});
test('F3. COLLECTIF HISTORIQUE : une désignation collective ANCIENNE reste valide relativement à SON observation, même si des données compatibles supplémentaires existent ensuite ; elle n\'est jamais revalidée contre le présent', async () => {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const t1 = await w.tour('tour 1');
  const appAncienne = applicationsSollicitables(t1.observation, undefined, t1.univers).applications.find((a) => a.operation === 'elementsObservables');
  assert.deepEqual(appAncienne.liaisons[0].donnees, [A.execution.id, B.execution.id].sort());
  const desAncienne = await enregistrerDesignation(w.magasin, { observation: t1.observation, application: appAncienne, origine: 'exterieure' });
  const dvo = await ajouterDecrire(w.magasin, 'decrireValeursObservees', 'paires', [{ id: 'a', valeur: 'x' }, { id: 'c' }]);
  const t2 = await w.tour('tour 2');
  assert.ok(compatiblesElements(t2).length > compatiblesElements(t1).length, 'des données compatibles supplémentaires existent');
  // la ligne ancienne est intacte et sa relation à SON observation reste vraie
  const lue = (await w.magasin.lireTout('designations')).find((d) => d.id === desAncienne.id);
  assert.deepEqual(lue, desAncienne); assert.equal(lue.idObservation, t1.observation.id);
  const enregistree = (await w.magasin.lireTout('observationsPossibilites')).find((o) => o.id === t1.observation.id);
  const toujours = await enregistrerDesignation(w.magasin, { observation: enregistree, application: appAncienne, origine: 'exterieure' });
  assert.deepEqual(toujours.liaisons, desAncienne.liaisons, 'toujours valide contre son observation');
  // contre le présent : l'ensemble ancien n'est PLUS l'ensemble exact -> refusé ; la règle ne joue que pour une NOUVELLE désignation
  await assert.rejects(enregistrerDesignation(w.magasin, { observation: t2.observation, application: appAncienne, origine: 'exterieure' }), TypeError);
  assert.equal(dvo.id.length > 0, true);
});

// ============================================================================ G. ABSENCE DE BOUCLE ET COMPATIBILITÉS
function sousFormesEtSorties() {
  const sorties = [];
  for (const d of DESCRIPTIONS_OPERATIONS) {
    sorties.push({ nom: `${d.nom}`, forme: d.sortie });
    for (const s of sousDonneesDeclarees(d.sortie)) sorties.push({ nom: `${d.nom}.${s.chemin[0]}`, forme: s.forme });
  }
  return sorties;
}
test('G1. ABSENCE DE BOUCLE avec le catalogue actuel : seules decrire* exposent une sous-donnée compatible avec elementsObservables ; leurs entrées ne sont garanties par AUCUNE production ni sous-donnée ; elementsObservables n\'expose aucune sous-donnée', () => {
  const attendue = desc('elementsObservables').entrees.elements.elements.champs.valeur;
  const sorties = sousFormesEtSorties();
  const compatibles = sorties.filter((s) => fournieGarantitAttendue(s.forme, attendue)).map((s) => s.nom).sort();
  assert.deepEqual(compatibles, ['decrireStructureIdentifiee.couverture', 'decrireValeursObservees.ambigus', 'decrireValeursObservees.nonResolus', 'symbolesDeChaine'], 'seules les sorties [S:chaîne] : symbolesDeChaine + trois sous-formes');
  for (const op of ['decrireStructureIdentifiee', 'decrireValeursObservees']) {
    for (const [entree, forme] of Object.entries(desc(op).entrees)) {
      const fournisseurs = sorties.filter((s) => { try { return fournieGarantitAttendue(s.forme, forme); } catch { return false; } }).map((s) => s.nom);
      assert.deepEqual(fournisseurs, [], `${op}.${entree} : aucune production ni sous-donnée ne l'alimente`);
    }
  }
  assert.deepEqual(sousDonneesDeclarees(desc('elementsObservables').sortie), []);
  assert.deepEqual(sousDonneesDeclarees(desc('symbolesDeChaine').sortie), []);
  // la donnée du message (chaîne) ne garantit pas non plus ces entrées
  for (const op of ['decrireStructureIdentifiee', 'decrireValeursObservees']) for (const forme of Object.values(desc(op).entrees)) assert.equal(fournieGarantitAttendue({ forme: 'scalaire', genre: 'chaine' }, forme), false);
});
test('G2. COMPATIBILITÉS NOUVELLES : les trois sous-données [[chaîne]] de partagerCouvertures sont compatibles avec les mêmes entrées que toute collection de collection de scalaire (collision de forme acceptée) et JAMAIS avec elementsObservables', () => {
  const sorties = sousFormesEtSorties();
  const sub = sorties.find((s) => s.nom === 'partagerCouvertures.seulementA').forme;
  const sortieChemins = desc('projeterChemins').sortie;
  const entrees = [];
  for (const d of DESCRIPTIONS_OPERATIONS) for (const [e, f] of Object.entries(d.entrees)) if (f.collectif !== true && fournieGarantitAttendue(sub, f)) entrees.push(`${d.nom}.${e}`);
  const memes = [];
  for (const d of DESCRIPTIONS_OPERATIONS) for (const [e, f] of Object.entries(d.entrees)) if (f.collectif !== true && fournieGarantitAttendue(sortieChemins, f)) memes.push(`${d.nom}.${e}`);
  assert.deepEqual(entrees, memes);
  assert.ok(entrees.length >= 2);
  assert.equal(entrees.includes('elementsObservables.elements'), false);
  for (const c of ['communs', 'seulementA', 'seulementB']) assert.deepEqual(sorties.find((s) => s.nom === `partagerCouvertures.${c}`).forme, sub);
});

// ============================================================================ H. CE QUI N'EST PAS TOUCHÉ
test('H1. VERSION_BASE, schéma de sauvegarde, tables, catalogue et table d\'opérations inchangés ; export/import : aller-retour JSON identique', async () => {
  assert.equal(VERSION_BASE, 19); assert.equal(SCHEMA_SAUVEGARDE, 9); assert.equal(TABLES.length, 22);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  const lignes = await MEMO.w.magasin.lireTout('executionsOperations');
  const tour = JSON.parse(JSON.stringify(lignes));
  assert.deepEqual(tour, lignes);
  assert.deepEqual(productionsDecrites(tour, DESCRIPTIONS_OPERATIONS), productionsDecrites(lignes, DESCRIPTIONS_OPERATIONS));
});
test('H2. le module est PUR : aucun import, aucune mémoire, aucun catalogue, aucun nom d\'opération ; un seul identifiant de génération injecté ; enregistrerExecutionOperation ne lit pas la table', () => {
  assert.equal((CODE.match(/^\s*import\b/gm) || []).length, 0);
  assert.equal(/\bimport\s*\(|\brequire\s*\(|magasin|lireTout|ecrire|localStorage|indexedDB|Date\b|Math\.random/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm).map((l) => l.replace(/\(.*$/, '')), ['export function sousDonneesDeclarees', 'export function formeSousDonnee', 'export function sousValeurConforme', 'export function valeurSousDonnee', 'export function sousDonneesCanoniques', 'export function preparerSousDonnees', 'export function indexSousDonnees']);
  for (const nom of ['partagerCouvertures', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'seulementA', 'communs', 'elementsObservables', 'DESCRIPTIONS_OPERATIONS']) assert.equal(CODE.includes(nom), false, nom);
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  const a = conn.indexOf('export async function enregistrerExecutionOperation('); const b = conn.indexOf('export async function enregistrerDesignation(');
  assert.ok(a > 0 && b > a);
  assert.equal(/lireTout|descriptions-operations|table-operations/.test(conn.slice(a, b)), false);
});
test('H3. aucune sélection ni exclusion « dérivée » : aucun test sur le caractère de sous-donnée dans les modules de possibilités, groupes, application unique, conformité', () => {
  for (const f of ['possibilites-liaison.js', 'groupes-candidats.js', 'application-unique.js', 'applications-sollicitables.js', 'conformite-application.js', 'valeurs-application.js', 'acces-valeur.js', 'acces-trace.js']) {
    const code = sansCommentaires(lu('app', 'langage', f));
    assert.equal(/sousDonnee|sous-donnee|sous_donnee|derive/i.test(code), false, f);
  }
  const importeurs = [];
  const visiter = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) visiter(p); else if (n.endsWith('.js') && /sous-donnees/.test(readFileSync(p, 'utf8').replace(/^\s*\/\/.*$/gm, ''))) importeurs.push(p.slice(RACINE.length + 1).split('\\').join('/')); } };
  visiter(join(RACINE, 'app'));
  assert.deepEqual(importeurs.filter((x) => x !== 'app/langage/sous-donnees.js').sort(), ['app/langage/connaissances.js', 'app/langage/execution-sollicitee.js', 'app/langage/observation-possibilites.js', 'app/langage/productions-decrites.js', 'app/langage/resoudre-identites.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.48 : + resoudre-identites.js (dormant) : indexSousDonnees et valeurSousDonnee pour résoudre une sous-donnée par identité
});
// === FIN_TEST_SOUS_DONNEES ===
