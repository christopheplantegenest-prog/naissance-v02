// v0.64.10 — « LE RÉFÉRENT DE SUITE SATISFAIT LE CONTRAT DE DONNÉE » (autorisation ChatGPT « v0.64.10 », 14/10/2026).
// Preuves : adresse technique canonique (encodage exact, aller-retour, concordance memeReferent <=> même adresse, refus) ; vue des données de
// référents (une donnée par intension, redécouverte -> +0, nouvelle intension -> +1, permutations sans effet, forme lue dans le descripteur,
// porteur non-exécution, résolution locale exacte) ; statut de donnée prouvé par le VRAI possibilitesDeLiaison, y compris à côté d'un univers
// réel construit par les mécanismes existants (aucune collision d'identité) ; pureté ; dormance.
// LIMITE : ces données ne sont dans aucun univers réel de Naissance ; rien n'est persisté, observé, lié ni exécuté.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/donnees-referents-suites.js';
import { adresseDuReferent, referentDepuisAdresse, donneesDeReferentsDeSuites, resoudreAdresseDeReferent } from '../app/langage/donnees-referents-suites.js';
import { referentDeSuite, memeReferent, manifestationsDuReferent } from '../app/langage/referents-suites.js';
import { produireSuitesFermees } from '../app/langage/suites-fermees.js';
import { elementsObservables } from '../app/langage/elements-observables.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { ACCES_VALEUR_DONNEE } from '../app/langage/valeur-donnee.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const car = (s) => [...s];
const R = (s) => referentDeSuite(typeof s === 'string' ? s.split('') : s);
const FORME_DECLAREE = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === 'produireSuitesFermees').sortie.elements.champs.contenu;
const el = (id, s) => ({ chemin: [id], contenu: s.split('') });
// Une ligne d'exécution de produireSuitesFermees dont le résultat est calculé par les primitives RÉELLES (identités d'événements opaques).
const ligneE = (id, elements) => ({ id, operation: 'produireSuitesFermees', liaisons: [{ entree: 'elements', donnee: `${id}-entree` }], resultat: produireSuitesFermees(elements) });
const E1 = ligneE('execution-operation-E1', [el('elem-E1-a', 'bonjour'), el('elem-E1-b', 'bonjour')]);
const E2 = ligneE('execution-operation-E2', [el('elem-E2-a', 'xbonjour'), el('elem-E2-b', 'bonjourz'), el('elem-E2-c', 'bonjour')]);
const ids = (donnees) => donnees.map((d) => d.donnee.identite);

// Échantillon du domaine .64.9 (tous les cas limites demandés).
const ECHANTILLON = [
  ['b', 'o', 'n'], ['b', 'o', 'n', 'j', 'o', 'u', 'r'], ['x'], [7], ['7'], [true], ['true'], [1], [false], [0], [-0], [''], ['', ''], [':'], ['|'], ['123'],
  ['referent-suite:x'], ['referent-suite:c1:a'], ['a', 'bc'], ['ab', 'c'], ['abc'], ['é'], ['😀'], ['\ud800'], ['\udc00', 'a'],
  [1.7976931348623157e308], [5e-324], [-5e-324], [1e21], [1e-7], [0.1], [-1.5], [123456789012345680000], [7, 'x'], ['7', 'x'], [0, -0], [-0, 0],
];

test('A1. contrat : quatre fonctions exportées ; espace réservé « referent-suite: » ; encodages exacts du mini-design', () => {
  assert.deepEqual(Object.keys(module).sort(), ['PREFIXE_REFERENT_SUITE', 'adresseDuReferent', 'donneesDeReferentsDeSuites', 'referentDepuisAdresse', 'resoudreAdresseDeReferent']); // MISE À JOUR DÉLIBÉRÉE v0.64.11 (admission des référents de suites) : + la constante de l'espace réservé (source unique pour l'observation, le résolveur, le contexte et l'empreinte)
  assert.equal(module.PREFIXE_REFERENT_SUITE, 'referent-suite:');
  const attendus = [
    [['b', 'o', 'n'], 'referent-suite:c1:bc1:oc1:n'],
    [[7], 'referent-suite:n1:7'], [['7'], 'referent-suite:c1:7'],
    [[true], 'referent-suite:b1:1'], [[false], 'referent-suite:b1:0'], [['true'], 'referent-suite:c4:true'],
    [[0], 'referent-suite:n1:0'], [[-0], 'referent-suite:n2:-0'],
    [[''], 'referent-suite:c0:'], [['', ''], 'referent-suite:c0:c0:'],
    [['a', 'bc'], 'referent-suite:c1:ac2:bc'], [['ab', 'c'], 'referent-suite:c2:abc1:c'],
    [['a:b|c'], 'referent-suite:c5:a:b|c'], [['referent-suite:x'], 'referent-suite:c16:referent-suite:x'],
    [['é', '😀'], 'referent-suite:c1:éc2:😀'], // 😀 = 2 unités UTF-16
    [[1e21, 5e-324, -1.5], 'referent-suite:n5:1e+21n6:5e-324n4:-1.5'],
  ];
  for (const [s, a] of attendus) assert.equal(adresseDuReferent(R(s)), a, JSON.stringify(s));
});

test('A2. aller-retour sur tout l\'échantillon : adresse → référent → adresse identique ; référent → adresse → référent memeReferent ; -0 et unités isolées préservés', () => {
  for (const s of ECHANTILLON) {
    const a = adresseDuReferent(R(s));
    assert.equal(typeof a, 'string');
    assert.ok(a.startsWith('referent-suite:'));
    const r = referentDepuisAdresse(a);
    assert.equal(memeReferent(r, R(s)), true, JSON.stringify(s));
    assert.equal(adresseDuReferent(r), a);
    for (let i = 0; i < s.length; i += 1) assert.ok(Object.is(r.suite[i], s[i]), `${JSON.stringify(s)}[${i}]`);
  }
});

test('A3. CONCORDANCE EXHAUSTIVE sur l\'échantillon : memeReferent(R1,R2) <=> adresse(R1) === adresse(R2) ; distinctions 0/-0, 7/"7", true/"true"/1, ["a","bc"]/["ab","c"]', () => {
  for (const a of ECHANTILLON) for (const b of ECHANTILLON) {
    assert.equal(adresseDuReferent(R(a)) === adresseDuReferent(R(b)), memeReferent(R(a), R(b)), `${JSON.stringify(a)} / ${JSON.stringify(b)}`);
  }
  const differentes = (a, b) => assert.notEqual(adresseDuReferent(R(a)), adresseDuReferent(R(b)));
  differentes([0], [-0]); differentes([7], ['7']); differentes([true], ['true']); differentes([true], [1]); differentes(['true'], [1]);
  differentes(['a', 'bc'], ['ab', 'c']); differentes(['a', 'bc'], ['abc']); differentes([''], ['', '']); differentes(['\ud800'], ['\udc00']);
  assert.equal(new Set(ECHANTILLON.map((s) => adresseDuReferent(R(s)))).size, ECHANTILLON.length);
});

test('A4. l\'adresse ne dépend que de l\'intension : clone, référent écrit à la main, redécouverte disjointe → même adresse', () => {
  const r = R('bonjour');
  assert.equal(adresseDuReferent(structuredClone(r)), adresseDuReferent(r));
  assert.equal(adresseDuReferent({ suite: car('bonjour') }), adresseDuReferent(r));
  const [r1] = donneesDeReferentsDeSuites([E1], DESCRIPTIONS_OPERATIONS).filter((d) => d.porteur.valeur.join('') === 'bonjour');
  const [r2] = donneesDeReferentsDeSuites([E2], DESCRIPTIONS_OPERATIONS).filter((d) => d.porteur.valeur.join('') === 'bonjour');
  assert.equal(r1.donnee.identite, r2.donnee.identite);
  assert.equal(r1.donnee.identite, 'referent-suite:c1:bc1:oc1:nc1:jc1:oc1:uc1:r');
});

test('A5. refus : adresses mal formées (préfixe absent ou voisin, reste vide, étiquette inconnue, longueur non canonique ou tronquée, charge non canonique, booléen invalide) et référents hors domaine', () => {
  const mauvaises = [
    7, null, undefined, '', 'x', 'referent-suit:c1:a', 'Referent-suite:c1:a', ' referent-suite:c1:a', 'referent-suites:c1:a', 'referent-suite',
    'referent-suite:', 'referent-suite:x1:a', 'referent-suite:C1:a', 'referent-suite:c', 'referent-suite:c:a', 'referent-suite:c01:a',
    'referent-suite:c00:', 'referent-suite:c5:a', 'referent-suite:c1a', 'referent-suite:c1:ab', 'referent-suite:c1:ac',
    'referent-suite:n3:1.0', 'referent-suite:n2:01', 'referent-suite:n3:1e3', 'referent-suite:n2: 1', 'referent-suite:n2:+1',
    'referent-suite:n4:0x10', 'referent-suite:n3:NaN', 'referent-suite:n8:Infinity', 'referent-suite:n0:', 'referent-suite:n2:-0n',
    'referent-suite:b1:2', 'referent-suite:b4:true', 'referent-suite:b0:', 'referent-suite:c1:an',
  ];
  for (const a of mauvaises) assert.throws(() => referentDepuisAdresse(a), TypeError, JSON.stringify(a));
  for (const r of [null, {}, { suite: [] }, { suite: [null] }, { suite: [NaN] }, { suite: [Infinity] }, { suite: [[1]] }, { suite: [{}] }, { suite: ['a'], autre: 1 }, 'referent-suite:c1:a']) {
    assert.throws(() => adresseDuReferent(r), TypeError, JSON.stringify(r));
  }
});

test('B1. REDÉCOUVERTE (test central) : E1 et E2, deux événements, deux résultats, manifestations distinctes → UNE donnée « bonjour », résolue exactement, sans identité d\'événement', () => {
  const d1 = donneesDeReferentsDeSuites([E1], DESCRIPTIONS_OPERATIONS);
  const d2 = donneesDeReferentsDeSuites([E2], DESCRIPTIONS_OPERATIONS);
  const d12 = donneesDeReferentsDeSuites([E1, E2], DESCRIPTIONS_OPERATIONS);
  const bonjour = adresseDuReferent(R('bonjour'));
  assert.equal(ids(d12).filter((x) => x === bonjour).length, 1);
  assert.ok(ids(d1).includes(bonjour) && ids(d2).includes(bonjour));
  // Union : exactement les intensions distinctes des deux événements (redécouverte → +0).
  assert.deepEqual(ids(d12), [...new Set([...ids(d1), ...ids(d2)])].sort());
  // Les manifestations restent distinctes et hors identité.
  const r = referentDepuisAdresse(bonjour);
  const m1 = manifestationsDuReferent(r, [el('elem-E1-a', 'bonjour'), el('elem-E1-b', 'bonjour')]);
  const m2 = manifestationsDuReferent(r, [el('elem-E2-c', 'bonjour')]);
  assert.equal(memeReferent(m1[0].referent, m2[0].referent), true);
  for (const trace of ['E1', 'E2', 'elem-', 'execution-operation', 'couverture', 'occurrences']) assert.equal(bonjour.includes(trace), false, trace);
  // Résolution exacte vers S.
  const [d] = d12.filter((x) => x.donnee.identite === bonjour);
  assert.deepEqual(valeurDePorteur(d.porteur, d.donnee, d.acces), car('bonjour'));
});

test('B2. dénombrement : E1(S1,S2) → 2 données ; S nouvelle → +1 ; redécouverte → +0 ; deux S différentes → deux données', () => {
  const d1 = donneesDeReferentsDeSuites([E1], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(d1.map((d) => d.porteur.valeur.join('')).sort(), ['bonjour', 'o']); // S1 = « bonjour », S2 = « o »
  const E3 = ligneE('execution-operation-E3', [el('elem-E3-a', 'bonjour'), el('elem-E3-b', 'bonjour')]); // redécouverte pure
  assert.deepEqual(ids(donneesDeReferentsDeSuites([E1, E3], DESCRIPTIONS_OPERATIONS)), ids(d1));
  const E4 = ligneE('execution-operation-E4', [el('elem-E4-a', 'merci'), el('elem-E4-b', 'merci')]); // intensions nouvelles
  const d14 = donneesDeReferentsDeSuites([E1, E4], DESCRIPTIONS_OPERATIONS);
  const nouvelles = ids(donneesDeReferentsDeSuites([E4], DESCRIPTIONS_OPERATIONS)).filter((x) => !ids(d1).includes(x));
  assert.equal(d14.length, d1.length + nouvelles.length);
  assert.ok(nouvelles.includes(adresseDuReferent(R('merci'))));
});

test('B3. permutations : ordre des lignes, ordre des items, ordre des éléments → MÊMES données (sortie identique) ; ordre de sortie sans signification', () => {
  const base = donneesDeReferentsDeSuites([E1, E2], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(donneesDeReferentsDeSuites([E2, E1], DESCRIPTIONS_OPERATIONS), base);
  const E2r = { ...E2, resultat: [...E2.resultat].reverse() };
  assert.deepEqual(donneesDeReferentsDeSuites([E1, E2r], DESCRIPTIONS_OPERATIONS), base);
  const E2p = ligneE('execution-operation-E2', [el('elem-E2-c', 'bonjour'), el('elem-E2-b', 'bonjourz'), el('elem-E2-a', 'xbonjour')]);
  assert.deepEqual(donneesDeReferentsDeSuites([E2p, E1], DESCRIPTIONS_OPERATIONS), base);
});

test('B4. source : seules les exécutions DÉCRITES de produireSuitesFermees ; opération non décrite → aucune donnée, sans erreur ; autres opérations ignorées ; preuve jamais lue', () => {
  const autre = { id: 'execution-operation-X', operation: 'projeterContenus', liaisons: [], resultat: [['z', 'z']] };
  assert.deepEqual(ids(donneesDeReferentsDeSuites([E1, autre], DESCRIPTIONS_OPERATIONS)), ids(donneesDeReferentsDeSuites([E1], DESCRIPTIONS_OPERATIONS)));
  const sansSuites = DESCRIPTIONS_OPERATIONS.filter((d) => d.nom !== 'produireSuitesFermees');
  assert.deepEqual(donneesDeReferentsDeSuites([E1, E2], sansSuites), []);
  assert.deepEqual(donneesDeReferentsDeSuites([], DESCRIPTIONS_OPERATIONS), []);
  // Preuve piégée : seuls les contenus sont lus.
  const piege = { contenu: car('bonjour') };
  for (const cle of ['occurrences', 'couverture']) Object.defineProperty(piege, cle, { get() { throw new Error(`preuve lue : ${cle}`); }, enumerable: true });
  const Ep = { id: 'execution-operation-P', operation: 'produireSuitesFermees', liaisons: [], resultat: [piege] };
  assert.deepEqual(ids(donneesDeReferentsDeSuites([Ep], DESCRIPTIONS_OPERATIONS)), [adresseDuReferent(R('bonjour'))]);
  assert.throws(() => donneesDeReferentsDeSuites('x', DESCRIPTIONS_OPERATIONS), TypeError);
  assert.throws(() => donneesDeReferentsDeSuites([{ id: 'execution-operation-Q', operation: 'produireSuitesFermees', liaisons: [], resultat: 'pas une collection' }], DESCRIPTIONS_OPERATIONS), TypeError);
});

test('B5. forme : copie EXACTE de la forme déclarée (sortie → elements → champs → contenu), identique pour toutes les S, lue dans le descripteur et jamais dans S', () => {
  assert.deepEqual(FORME_DECLAREE, { forme: 'collection', elements: { forme: 'scalaire' } });
  const d = donneesDeReferentsDeSuites([E1, E2, ligneE('execution-operation-E5', [el('n1', 'ab'), el('n2', 'ab')])], DESCRIPTIONS_OPERATIONS);
  for (const x of d) { assert.deepEqual(x.donnee.forme, FORME_DECLAREE); assert.notEqual(x.donnee.forme, FORME_DECLAREE); }
  // Preuve que la forme vient du descripteur : un catalogue (de test) qui déclare autre chose donne cette autre forme.
  const autreForme = { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } };
  const modifie = DESCRIPTIONS_OPERATIONS.map((x) => (x.nom === 'produireSuitesFermees' ? { ...x, sortie: { ...x.sortie, elements: { ...x.sortie.elements, champs: { ...x.sortie.elements.champs, contenu: autreForme } } } } : x));
  for (const x of donneesDeReferentsDeSuites([E1], modifie)) assert.deepEqual(x.donnee.forme, autreForme);
});

test('B6. porteur et résolution LOCALE : porteur { id, valeur } (ni operation, ni liaisons, ni idExecution), accès existant ; resoudreAdresseDeReferent sans vécu = la donnée de la vue', () => {
  for (const d of donneesDeReferentsDeSuites([E1, E2], DESCRIPTIONS_OPERATIONS)) {
    assert.deepEqual(Object.keys(d).sort(), ['acces', 'donnee', 'porteur']);
    assert.deepEqual(Object.keys(d.porteur).sort(), ['id', 'valeur']);
    assert.equal(d.porteur.id, d.donnee.identite);
    assert.deepEqual(d.acces, ACCES_VALEUR_DONNEE);
    assert.deepEqual(resoudreAdresseDeReferent(d.donnee.identite, DESCRIPTIONS_OPERATIONS), d);
  }
  for (const s of [[-0, 'x'], ['😀', true], [5e-324]]) {
    const r = resoudreAdresseDeReferent(adresseDuReferent(R(s)), DESCRIPTIONS_OPERATIONS);
    const v = valeurDePorteur(r.porteur, r.donnee, r.acces);
    assert.equal(v.length, s.length);
    for (let i = 0; i < s.length; i += 1) assert.ok(Object.is(v[i], s[i]));
  }
  assert.throws(() => resoudreAdresseDeReferent('referent-suite:c1:a', DESCRIPTIONS_OPERATIONS.filter((d) => d.nom !== 'produireSuitesFermees')), TypeError);
  assert.throws(() => resoudreAdresseDeReferent('execution-operation-E1', DESCRIPTIONS_OPERATIONS), TypeError);
});

test('C1. STATUT DE DONNÉE : le VRAI possibilitesDeLiaison accepte les données sans branche spéciale ; possibilités exactes = celles que le catalogue garantit pour la forme déclarée ; mêmes possibilités quelle que soit la découverte', () => {
  const d1 = donneesDeReferentsDeSuites([E1], DESCRIPTIONS_OPERATIONS).filter((d) => d.porteur.valeur.join('') === 'bonjour');
  const d2 = donneesDeReferentsDeSuites([E2], DESCRIPTIONS_OPERATIONS).filter((d) => d.porteur.valeur.join('') === 'bonjour');
  const p1 = possibilitesDeLiaison(d1.map((d) => d.donnee), DESCRIPTIONS_OPERATIONS);
  const p2 = possibilitesDeLiaison(d2.map((d) => d.donnee), DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(p1, p2);
  // Attendu calculé depuis le code réel (garantie de forme), puis comparé à la sonde de conception.
  const attendu = [];
  for (const d of DESCRIPTIONS_OPERATIONS) for (const [entree, forme] of Object.entries(valider(d).entrees)) if (fournieGarantitAttendue(FORME_DECLAREE, forme)) attendu.push(`${d.nom}.${entree}`);
  assert.deepEqual(p1.map((a) => `${a.operation}.${a.entree}`).sort(), attendu.sort());
  assert.deepEqual(attendu.sort(), ['couvrirSequence.elements', 'parcourirStructure.valeur']);
  assert.ok(p1.every((a) => a.donnee === d1[0].donnee.identite));
  // Toutes les données de la vue ensemble : acceptées (identités uniques), 2 possibilités chacune.
  const tout = donneesDeReferentsDeSuites([E1, E2], DESCRIPTIONS_OPERATIONS);
  assert.equal(possibilitesDeLiaison(tout.map((d) => d.donnee), DESCRIPTIONS_OPERATIONS).length, 2 * tout.length);
});

async function tour(magasin, texte, n) {
  let k = n * 100;
  const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
  const r = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
  assert.equal(r.statut, 'ecrite');
  return { observation: r.observation, univers: r.univers };
}
const executer = (t, operation, magasin) => {
  const application = applicationsSollicitables(t.observation, undefined, t.univers).applications.find((a) => a.operation === operation);
  assert.ok(application, operation);
  return executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
};

test('C2. VÉCU RÉEL (mécanismes existants : observation, application, désignation, exécution persistée) : la vue lit les vraies lignes ; à côté de l\'univers réel d\'un tour, AUCUNE collision d\'identité ; les possibilités des données ordinaires sont inchangées', async () => {
  const magasin = magasinMemoireVive();
  const t1 = await tour(magasin, 'bonjour Pixel', 1);
  await executer(t1, 'symbolesDeChaine', magasin);
  const t2 = await tour(magasin, 'bonjour Lune', 2);
  await executer(t2, 'symbolesDeChaine', magasin);
  const t3 = await tour(magasin, 'troisième', 3);
  await executer(t3, 'elementsObservables', magasin);
  const t4 = await tour(magasin, 'quatrième', 4);
  const rS = await executer(t4, 'produireSuitesFermees', magasin);
  assert.equal(rS.statut, 'executee');
  const lignes = await magasin.lireTout('executionsOperations');
  const donnees = donneesDeReferentsDeSuites(lignes, DESCRIPTIONS_OPERATIONS);
  assert.ok(donnees.length > 0);
  assert.ok(ids(donnees).includes(adresseDuReferent(R('bonjour '))));
  const t5 = await tour(magasin, 'cinquième', 5);
  // MISE À JOUR DÉLIBÉRÉE v0.64.11 (admission des référents de suites) : depuis v0.64.11, l'univers réel du tour CONTIENT les référents acquis, EXACTEMENT les données de la vue (mêmes identités, formes, porteurs, accès).
  const admis = t5.univers.filter((u) => u.donnee.identite.startsWith('referent-suite:'));
  assert.deepEqual(admis, donnees);
  // Aucune identité ORDINAIRE du vécu ne commence par l'espace réservé.
  const ordinaires = t5.univers.filter((u) => !u.donnee.identite.startsWith('referent-suite:')).map((u) => u.donnee);
  for (const d of ordinaires) assert.equal(d.identite.startsWith('referent-suite:'), false, d.identite);
  const avec = possibilitesDeLiaison([...ordinaires, ...donnees.map((d) => d.donnee)], DESCRIPTIONS_OPERATIONS); // lèverait sur toute collision
  const seules = possibilitesDeLiaison(ordinaires, DESCRIPTIONS_OPERATIONS);
  const cle = (a) => `${a.donnee}|${a.operation}|${a.entree}`;
  const referents = new Set(ids(donnees));
  assert.deepEqual(avec.filter((a) => !referents.has(a.donnee)).map(cle).sort(), seules.map(cle).sort());
  assert.equal(avec.length - seules.length, 2 * donnees.length);
  // Le vécu réel n'est pas modifié par la vue (lecture pure).
  assert.deepEqual(await magasin.lireTout('executionsOperations'), lignes);
});

test('D1. pureté : entrées jamais modifiées ; aucun JSON, hash, nouvelId, horloge, hasard ; imports exactement les deux modules prévus', () => {
  const lignes = [structuredClone(E1), structuredClone(E2)];
  const avant = structuredClone(lignes);
  const descriptions = structuredClone(DESCRIPTIONS_OPERATIONS);
  donneesDeReferentsDeSuites(lignes, descriptions);
  assert.deepEqual(lignes, avant);
  assert.deepEqual(descriptions, DESCRIPTIONS_OPERATIONS);
  const code = readFileSync(join(RACINE, 'app', 'langage', 'donnees-referents-suites.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/JSON\.|nouvelId|Date|Math\.random|hash|crypto|magasin|lireTout|ecrire\(/i.test(code), false);
  const imports = [...code.matchAll(/^\s*import\b[^;]*from\s+'([^']+)'/gm)].map((x) => x[1]).sort();
  assert.deepEqual(imports, ['./referents-suites.js', './valeur-donnee.js']);
});

test('D2. dormance LEVÉE de façon BORNÉE (MISE À JOUR DÉLIBÉRÉE v0.64.11 (admission des référents de suites)) : le module n\'est importé QUE par l\'observation, le résolveur général, le contexte d\'observation et l\'empreinte de catégorie ; ni lot, ni .93, ni .94, ni main, ni pont', () => {
  const importeurs = [];
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f.endsWith(join('langage', 'donnees-referents-suites.js'))) continue;
    const texte = readFileSync(f, 'utf8');
    if (/from '\.\/donnees-referents-suites\.js'/.test(texte)) importeurs.push(f.slice(RACINE.length + 1).split('\\').join('/'));
    else assert.equal(/donnees-referents-suites|adresseDuReferent|referentDepuisAdresse|donneesDeReferentsDeSuites|resoudreAdresseDeReferent/.test(texte), false, f);
  }
  assert.deepEqual(importeurs.sort(), ['app/langage/contexte-observation.js', 'app/langage/empreinte-categorie-referents.js', 'app/langage/observation-possibilites.js', 'app/langage/resoudre-identites.js']);
  for (const f of ['main.js', 'langage/pont.js', 'langage/execution-mecanique.js', 'langage/applications-sollicitables.js', 'langage/determination-relative.js', 'langage/possibilites-liaison.js', 'langage/besoins.js', 'langage/capacite.js', 'langage/relation.js']) {
    assert.equal(/referent-suite|donnees-referents-suites|referents-suites/.test(readFileSync(join(RACINE, 'app', ...f.split('/')), 'utf8')), false, f);
  }
  for (const f of [['index.html'], ['sw.js']]) {
    let texte = '';
    try { texte = readFileSync(join(RACINE, ...f), 'utf8'); } catch { texte = ''; }
    assert.equal(/donnees-referents-suites/.test(texte), false, f.join('/'));
  }
});
