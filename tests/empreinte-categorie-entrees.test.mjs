// v0.63.56 — « EMPREINTE DU CONTRAT DE LA CATÉGORIE « ENTRÉES D'UNE PRODUCTION » » (décision ChatGPT, 06/10/2026) : calcul pur, synchrone, dormant.
// Aucune persistance, aucun snapshot, aucune vérification historique : on prouve seulement que l'empreinte existe, est stable, et change quand le contrat change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as module from '../app/langage/empreinte-categorie-entrees.js';
import { canoniserContratCategorie, contratEntreesProduction, canoniqueContratEntreesProduction, empreinteContratEntreesProduction } from '../app/langage/empreinte-categorie-entrees.js';
import { PREFIXE_IDENTITE_ENTREES, FORME_ENTREES_PRODUCTION, ACCES_ENTREES_PRODUCTION, identiteEntreesProduction, productionDesEntrees, estIdentiteEntrees } from '../app/langage/entrees-donnee.js';
import { sha256Hex } from '../app/langage/sha256.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { DESCRIPTIONS_OPERATIONS as C16 } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const CODE = sansCommentaires(lu('app', 'langage', 'empreinte-categorie-entrees.js'));
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)));
const clone = (v) => JSON.parse(JSON.stringify(v));
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const HEX64 = /^[0-9a-f]{64}$/;
// Valeur de référence : si le contrat change VOLONTAIREMENT, ce test échoue et doit être mis à jour avec la décision correspondante.
const EMPREINTE_V1 = '2c476565fc81d5ecd1e0af1dbbd015c399f36ec06c723fff233b32ba3c485d52';
const empreinteDe = (contrat) => sha256Hex(canoniserContratCategorie(contrat));

// ============================================================================ A. API ET CONTRAT
test('A1. surface : quatre fonctions synchrones + le nom de la catégorie ; aucun argument nécessaire pour le contrat réel', () => {
  // MISE À JOUR DÉLIBÉRÉE v0.63.57 : + CATEGORIE_ENTREES_PRODUCTION (nom de la catégorie, défini une seule fois ; utilisé par le contrat et par la preuve persistée).
  assert.deepEqual(Object.keys(module).sort(), ['CATEGORIE_ENTREES_PRODUCTION', 'canoniqueContratEntreesProduction', 'canoniserContratCategorie', 'contratEntreesProduction', 'empreinteContratEntreesProduction']);
  assert.equal(module.CATEGORIE_ENTREES_PRODUCTION, 'entrees-de-production');
  for (const [nom, f] of Object.entries(module)) if (typeof f === 'function') assert.equal(f.constructor.name, 'Function', nom);
  assert.equal(contratEntreesProduction.length, 0); assert.equal(canoniqueContratEntreesProduction.length, 0); assert.equal(empreinteContratEntreesProduction.length, 0);
  assert.equal(typeof canoniqueContratEntreesProduction(), 'string');
  assert.equal(empreinteContratEntreesProduction() instanceof Promise, false);
});
test('A2. OBJET EXACT empreinté : { categorie, identite: { prefixe, sondes }, forme, acces }, sans rien d\'autre (ni version, ni catalogue, ni valeur)', () => {
  const c = contratEntreesProduction();
  assert.deepEqual(Object.keys(c), ['categorie', 'identite', 'forme', 'acces']);
  assert.equal(c.categorie, 'entrees-de-production');
  assert.deepEqual(Object.keys(c.identite), ['prefixe', 'sondes']);
  assert.equal(c.identite.prefixe, PREFIXE_IDENTITE_ENTREES);
  assert.deepEqual(c.forme, FORME_ENTREES_PRODUCTION);
  assert.deepEqual(c.acces, ACCES_ENTREES_PRODUCTION);
  assert.equal(c.identite.sondes.length, 7);
  for (const s of c.identite.sondes) assert.deepEqual(Object.keys(s), ['chaine', 'derivee', 'reconnue', 'inverse']);
  const texte = JSON.stringify(c);
  for (const interdit of ['version', 'VERSION', 'horodatage', 'sha', 'entreesDeProduction', 'descriptions', 'observation', 'execution-operation']) assert.equal(texte.includes(interdit), false, interdit);
});
test('A3. le contrat est un objet NEUF à chaque appel : modifier le résultat ne touche ni les constantes ni l\'appel suivant', () => {
  const a = contratEntreesProduction(); const b = contratEntreesProduction();
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a.forme, b.forme); assert.notEqual(a.forme, FORME_ENTREES_PRODUCTION); assert.notEqual(a.acces, ACCES_ENTREES_PRODUCTION);
  a.forme.elements.champs.entree.genre = 'nombre'; a.acces.champ = 'x'; a.identite.prefixe = 'x:'; a.identite.sondes.length = 0;
  assert.deepEqual(contratEntreesProduction(), b);
  assert.equal(FORME_ENTREES_PRODUCTION.elements.champs.entree.genre, 'chaine'); assert.equal(ACCES_ENTREES_PRODUCTION.champ, 'entrees');
});
test('A4. EMPREINTE : SHA-256 complet, 64 hexadécimaux minuscules, = sha256Hex(canonique) ; valeur de référence v1', () => {
  const e = empreinteContratEntreesProduction();
  assert.match(e, HEX64);
  assert.equal(e, sha256Hex(canoniqueContratEntreesProduction()));
  assert.equal(e, EMPREINTE_V1);
});
test('A5. STABILITÉ : deux appels = même canonique, même empreinte ; la chaîne canonique est un JSON valide qui se relit en contrat', () => {
  assert.equal(canoniqueContratEntreesProduction(), canoniqueContratEntreesProduction());
  assert.equal(empreinteContratEntreesProduction(), empreinteContratEntreesProduction());
  assert.deepEqual(JSON.parse(canoniqueContratEntreesProduction()), contratEntreesProduction());
  assert.equal(canoniqueContratEntreesProduction(), canoniserContratCategorie(contratEntreesProduction()));
});

// ============================================================================ B. SOURCE UNIQUE
test('B1. SOURCE UNIQUE forme : la forme empreintée est celle que resoudreIdentitesDonnees rend pour la catégorie (égalité profonde), copie de la constante unique', () => {
  const lignesValeurs = [{ id: 'm1', valeur: 'bonjour' }];
  const exec = { id: 'e1', horodatage: 'h', idDesignation: 'd1', operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: 'm1' }], resultat: ['b'] };
  const [r] = resoudreIdentitesDonnees([identiteEntreesProduction('e1')], lignesValeurs, [exec], C16);
  assert.deepEqual(r.donnee.forme, contratEntreesProduction().forme);
  assert.deepEqual(r.donnee.forme, FORME_ENTREES_PRODUCTION);
});
test('B2. SOURCE UNIQUE accès : l\'accès empreinté EST celui de la résolution (même référence rendue), pas une reconstruction', () => {
  const [r] = resoudreIdentitesDonnees([identiteEntreesProduction('e1')], [{ id: 'm1', valeur: 'x' }], [{ id: 'e1', horodatage: 'h', idDesignation: 'd1', operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: 'm1' }], resultat: ['b'] }], C16);
  assert.equal(r.acces, ACCES_ENTREES_PRODUCTION);
  assert.deepEqual(contratEntreesProduction().acces, r.acces);
});
test('B3. SOURCE UNIQUE identité : une identité dérivée RÉELLE est conforme à la convention empreintée (préfixe et sondes)', () => {
  const c = contratEntreesProduction();
  for (const id of ['execution-operation-1791291018118-3-634', 'e1', 'a:b']) {
    const d = identiteEntreesProduction(id);
    assert.equal(d, c.identite.prefixe + id);
    assert.equal(productionDesEntrees(d), id); assert.equal(estIdentiteEntrees(d), true);
  }
  const par = new Map(c.identite.sondes.map((s) => [s.chaine, s]));
  assert.equal(par.get('x').derivee, c.identite.prefixe + 'x');
  assert.equal(par.get(c.identite.prefixe + 'x').inverse, 'x'); assert.equal(par.get(c.identite.prefixe + 'x').reconnue, true);
  assert.equal(par.get(c.identite.prefixe).reconnue, false); assert.equal(par.get('').derivee, null);
  assert.equal(par.get(c.identite.prefixe + c.identite.prefixe + 'x').inverse, null);
});
test('B4. aucune seconde copie : le littéral du préfixe et celui de la forme ne sont définis que dans entrees-donnee.js ; le nouveau module n\'importe que sha256.js et entrees-donnee.js', () => {
  const sources = [];
  const parcourir = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) parcourir(p); else if (/\.(m?js|html)$/.test(n)) sources.push(p); } };
  parcourir(join(RACINE, 'app'));
  const rel = (f) => relative(RACINE, f).split('\\').join('/');
  const code = (f) => sansCommentaires(readFileSync(f, 'utf8'));
  assert.deepEqual(sources.filter((f) => code(f).includes("'entrees-de-production:'")).map(rel), ['app/langage/entrees-donnee.js']);
  assert.deepEqual(sources.filter((f) => /donnees: \{ forme: 'collection'/.test(code(f))).map(rel), ['app/langage/entrees-donnee.js']);
  assert.deepEqual(sources.filter((f) => code(f).includes("champ: 'entrees'")).map(rel), ['app/langage/entrees-donnee.js']);
  assert.deepEqual([...CODE.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./entrees-donnee.js', './sha256.js']);
  assert.equal(CODE.includes('entrees-de-production:'), false);
  assert.equal(CODE.includes("'entrees'"), false);
});

// ============================================================================ C. CANONISATION ET STABILITÉ
test('C1. ORDRE DES CLÉS sans effet (objets construits dans un autre ordre), ORDRE DES TABLEAUX significatif', () => {
  const base = contratEntreesProduction();
  const renverse = (v) => (Array.isArray(v) ? v.map(renverse) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, renverse(v[k])])) : v);
  assert.deepEqual(Object.keys(renverse(base)), [...Object.keys(base)].reverse());
  assert.equal(canoniserContratCategorie(renverse(base)), canoniserContratCategorie(base));
  assert.equal(empreinteDe(renverse(base)), empreinteContratEntreesProduction());
  const permute = clone(base); permute.identite.sondes.reverse();
  assert.notEqual(canoniserContratCategorie(permute), canoniserContratCategorie(base));
});
test('C2. objets GELÉS acceptés ; aucune mutation du contrat fourni', () => {
  const base = gelProfond(contratEntreesProduction());
  const avant = JSON.stringify(base);
  assert.equal(canoniserContratCategorie(base), canoniqueContratEntreesProduction());
  assert.equal(JSON.stringify(base), avant);
  assert.equal(Object.isFrozen(base), true);
});
test('C3. UNICODE déterministe, sans normalisation : même chaîne = même sortie ; NFC et NFD restent distincts ; échappements JSON valides', () => {
  const v = (x) => canoniserContratCategorie({ a: x });
  assert.equal(v('é'), '{"a":"é"}');
  assert.equal(v('😀'), '{"a":"😀"}'); assert.equal(v('😀'), v('😀'));
  assert.notEqual(v('e\u0301'), v('\u00e9'));
  assert.equal(v('"\\\n\u0000'), '{"a":"\\"\\\\\\n\\u0000"}');
  assert.equal(canoniserContratCategorie({ 'é': 1, 'e': 2, 'Z': 3 }), '{"Z":3,"e":2,"é":1}', 'clés triées par unités de code');
  assert.equal(canoniserContratCategorie({ '10': 'a', '2': 'b', 'a': 'c' }), '{"10":"a","2":"b","a":"c"}', 'clés entières : tri par unités de code, pas par ordre d\'insertion de JSON');
  assert.equal(JSON.parse(v('\ud83d')).a, '\ud83d', 'surrogate isolé : sortie déterministe et relisible');
});
test('C4. types REFUSÉS : undefined, fonction, symbole, bigint, nombre non fini, accesseur, tableau creux, objet non simple, clé symbole, contrat non objet', () => {
  const sym = Symbol('s');
  const accesseur = {}; Object.defineProperty(accesseur, 'a', { get() { return 1; }, enumerable: true });
  const creux = [1, , 3]; // eslint-disable-line no-sparse-arrays
  class Classe { constructor() { this.a = 1; } }
  const avecSymbole = { a: 1 }; avecSymbole[sym] = 2;
  for (const mauvais of [undefined, () => 1, sym, 10n, NaN, Infinity, -Infinity]) refuse(() => canoniserContratCategorie({ a: mauvais }));
  refuse(() => canoniserContratCategorie({ a: accesseur }), /accesseur/);
  refuse(() => canoniserContratCategorie({ a: creux }));
  for (const bizarre of [new Classe(), new Map(), new Date(0), /x/, new Set()]) refuse(() => canoniserContratCategorie({ a: bizarre }), /non simple/);
  refuse(() => canoniserContratCategorie(avecSymbole), /symbole/);
  for (const nonContrat of [null, undefined, 3, 'x', [], true]) refuse(() => canoniserContratCategorie(nonContrat), /doit être un objet/);
  assert.equal(canoniserContratCategorie({ a: Object.create(null) }), '{"a":{}}', 'objet sans prototype accepté');
});
test('C5. deux contrats LOGIQUEMENT égaux (même contenu, autre construction) donnent la même chaîne ; un contenu différent, une chaîne différente', () => {
  const base = contratEntreesProduction();
  assert.equal(canoniserContratCategorie(clone(base)), canoniserContratCategorie(base));
  assert.equal(canoniserContratCategorie(JSON.parse(JSON.stringify(base, null, 4))), canoniserContratCategorie(base));
  const autre = clone(base); autre.categorie = 'autre';
  assert.notEqual(canoniserContratCategorie(autre), canoniserContratCategorie(base));
});

// ============================================================================ D. SENSIBILITÉ (variantes du contrat fourni)
test('D1. PRÉFIXE : un autre préfixe change la chaîne canonique et l\'empreinte', () => {
  const v = clone(contratEntreesProduction()); v.identite.prefixe = 'entrees-de-prod:';
  assert.notEqual(empreinteDe(v), EMPREINTE_V1);
  const w = clone(contratEntreesProduction()); w.identite.prefixe += ' '; assert.notEqual(empreinteDe(w), EMPREINTE_V1);
});
test('D2. FORME : genre, fait, nom de champ, présence d\'un champ, élément de collection : chaque changement change l\'empreinte, toutes distinctes', () => {
  const variantes = [
    (c) => { c.forme.elements.champs.entree.genre = 'nombre'; },
    (c) => { delete c.forme.elements.champs.donnee.peutManquer; },
    (c) => { c.forme.elements.champs.donnee.peutManquer = false; },
    (c) => { c.forme.elements.champs.donnees.elements.genre = 'nombre'; },
    (c) => { c.forme.elements.champs.donnees.forme = 'quelconque'; },
    (c) => { c.forme.elements.champs.liaison = c.forme.elements.champs.entree; delete c.forme.elements.champs.entree; },
    (c) => { delete c.forme.elements.champs.donnees; },
    (c) => { c.forme.forme = 'objet'; },
    (c) => { c.forme.elements.champs.entree.peutEtreNull = true; },
  ];
  const vues = new Set([EMPREINTE_V1]);
  for (const modifier of variantes) { const c = clone(contratEntreesProduction()); modifier(c); const e = empreinteDe(c); assert.match(e, HEX64); assert.equal(vues.has(e), false); vues.add(e); }
  assert.equal(vues.size, variantes.length + 1);
});
test('D3. ACCÈS : un autre champ d\'accès (entrees → autre chose), ou un accès supplémentaire, change l\'empreinte', () => {
  const v = clone(contratEntreesProduction()); v.acces.champ = 'resultat'; assert.notEqual(empreinteDe(v), EMPREINTE_V1);
  const w = clone(contratEntreesProduction()); w.acces.champ = 'liaisons'; assert.notEqual(empreinteDe(w), empreinteDe(v));
  const x = clone(contratEntreesProduction()); x.acces.autre = 1; assert.notEqual(empreinteDe(x), EMPREINTE_V1);
});
test('D4. RÈGLE D\'IDENTITÉ : changer une sonde (domaine, image, inverse) change l\'empreinte même si le préfixe est identique', () => {
  for (const modifier of [(s) => { s[0].derivee = null; }, (s) => { s[4].reconnue = false; }, (s) => { s[4].inverse = 'y'; }, (s) => { s[2].derivee = 'x'; }, (s) => { s.pop(); }]) {
    const c = clone(contratEntreesProduction()); modifier(c.identite.sondes); assert.notEqual(empreinteDe(c), EMPREINTE_V1);
  }
});

// ============================================================================ E. SENSIBILITÉ RÉELLE (copies du code, constantes de production jamais mutées)
function copieModifiee(modifier) {
  const dossier = mkdtempSync(join(tmpdir(), 'cat56-'));
  for (const f of ['entrees-donnee.js', 'sha256.js', 'empreinte-categorie-entrees.js']) copyFileSync(join(RACINE, 'app', 'langage', f), join(dossier, f));
  modifier(dossier);
  return dossier;
}
const patcher = (dossier, fichier, de, vers) => {
  const p = join(dossier, fichier); const s = readFileSync(p, 'utf8');
  assert.equal(s.includes(de), true, `motif introuvable : ${de}`);
  writeFileSync(p, s.replace(de, vers));
};
async function empreinteDeCopie(modifier) {
  const dossier = copieModifiee(modifier);
  try {
    const m = await import(pathToFileURL(join(dossier, 'empreinte-categorie-entrees.js')).href);
    return { empreinte: m.empreinteContratEntreesProduction(), contrat: m.contratEntreesProduction() };
  } finally { rmSync(dossier, { recursive: true, force: true }); }
}
test('E1. la copie NON modifiée donne exactement la même empreinte (le montage de test est fidèle)', async () => {
  const { empreinte } = await empreinteDeCopie(() => {});
  assert.equal(empreinte, empreinteContratEntreesProduction());
});
test('E2. PRÉFIXE RÉEL modifié dans le code : l\'empreinte change', async () => {
  const { empreinte, contrat } = await empreinteDeCopie((d) => patcher(d, 'entrees-donnee.js', "'entrees-de-production:'", "'entrees-de-prod:'"));
  assert.notEqual(empreinte, EMPREINTE_V1); assert.equal(contrat.identite.prefixe, 'entrees-de-prod:');
});
test('E3. FORME RÉELLE modifiée dans le code : l\'empreinte change', async () => {
  const { empreinte } = await empreinteDeCopie((d) => patcher(d, 'entrees-donnee.js', "entree: { forme: 'scalaire', genre: 'chaine' },", "entree: { forme: 'scalaire', genre: 'nombre' },"));
  assert.notEqual(empreinte, EMPREINTE_V1);
});
test('E4. ACCÈS RÉEL modifié dans le code (entrees → autre chose) : l\'empreinte change', async () => {
  const { empreinte, contrat } = await empreinteDeCopie((d) => patcher(d, 'entrees-donnee.js', "Object.freeze({ champ: 'entrees' })", "Object.freeze({ champ: 'provenance' })"));
  assert.notEqual(empreinte, EMPREINTE_V1); assert.equal(contrat.acces.champ, 'provenance');
});
test('E5. RÈGLE D\'IDENTITÉ RÉELLE modifiée (l\'inverse ne refuse plus un double préfixe ; la dérivation accepte une identité déjà dérivée) : l\'empreinte change par les sondes, sans changer le préfixe', async () => {
  const a = await empreinteDeCopie((d) => patcher(d, 'entrees-donnee.js', "  if (idProduction.startsWith(PREFIXE_IDENTITE_ENTREES)) refuser(NOM,", "  if (false) refuser(NOM,"));
  assert.notEqual(a.empreinte, EMPREINTE_V1); assert.equal(a.contrat.identite.prefixe, PREFIXE_IDENTITE_ENTREES);
  const b = await empreinteDeCopie((d) => patcher(d, 'entrees-donnee.js', "return reste.length > 0 && !reste.startsWith(PREFIXE_IDENTITE_ENTREES);", "return reste.length > 0;"));
  assert.notEqual(b.empreinte, EMPREINTE_V1); assert.notEqual(b.empreinte, a.empreinte);
});
test('E6. on protège le CONTRAT, pas l\'implémentation : commentaires, renommage interne et reformatage ne changent PAS l\'empreinte', async () => {
  const { empreinte } = await empreinteDeCopie((d) => {
    patcher(d, 'entrees-donnee.js', "const NOM = 'identiteEntreesProduction';", "// commentaire ajouté\nconst NOM = 'identiteEntreesProduction';");
    patcher(d, 'entrees-donnee.js', 'function gelerProfond(valeur) {', 'function gelerProfond(valeur /* renommé ? non */) {');
    patcher(d, 'empreinte-categorie-entrees.js', 'const comparer = (a, b) =>', 'const   comparer   =   (a, b) =>');
  });
  assert.equal(empreinte, EMPREINTE_V1);
});

// ============================================================================ F. TEST CENTRAL J10-CATÉGORIE
test('F1. J10-CATÉGORIE : une dérive de forme NEUTRE sur les atomes (mêmes possibilités sous C16) donne pourtant une empreinte DIFFÉRENTE', async () => {
  const v2 = await empreinteDeCopie((d) => patcher(d, 'entrees-donnee.js', "entree: { forme: 'scalaire', genre: 'chaine' },", "entree: { forme: 'scalaire', genre: 'nombre' },"));
  const atomes = (forme) => possibilitesDeLiaison([{ identite: 'sonde', forme: clone(forme) }], C16).map((a) => `${a.operation}.${a.entree}`).sort();
  const atomesV1 = atomes(FORME_ENTREES_PRODUCTION); const atomesV2 = atomes(v2.contrat.forme);
  assert.deepEqual(atomesV1, ['couvrirSequence.elements', 'parcourirStructure.valeur']);
  assert.deepEqual(atomesV2, atomesV1, 'mêmes atomes : une observation persistée ne verrait rien');
  assert.notDeepEqual(v2.contrat.forme, FORME_ENTREES_PRODUCTION, 'forme mécaniquement différente');
  assert.notEqual(v2.empreinte, empreinteContratEntreesProduction(), 'empreintes différentes : la dérive devient détectable');
});
test('F2. à l\'inverse, une dérive qui CHANGE les atomes (forme devenue objet) change aussi l\'empreinte', async () => {
  const v2 = await empreinteDeCopie((d) => patcher(d, 'entrees-donnee.js', 'export const FORME_ENTREES_PRODUCTION = gelerProfond({', "export const FORME_ENTREES_PRODUCTION = gelerProfond({ forme: 'scalaire', genre: 'chaine' }); const _ANCIENNE = ({"));
  const atomes = possibilitesDeLiaison([{ identite: 'sonde', forme: clone(v2.contrat.forme) }], C16).map((a) => `${a.operation}.${a.entree}`).sort();
  assert.notDeepEqual(atomes, ['couvrirSequence.elements', 'parcourirStructure.valeur']);
  assert.notEqual(v2.empreinte, empreinteContratEntreesProduction());
});

// ============================================================================ G. DORMANCE, PURETÉ, AUCUN AUTRE EFFET
test('G1. DORMANCE : aucun fichier de app/ ne nomme le module ni ses fonctions en dehors de lui-même ; ni resoudreIdentitesDonnees, ni contexte, ni observation, ni désignation, ni exécution', () => {
  const sources = [];
  const parcourir = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) parcourir(p); else if (/\.(m?js|html)$/.test(n)) sources.push(p); } };
  parcourir(join(RACINE, 'app'));
  const motif = /empreinte-categorie-entrees|empreinteContratEntreesProduction|canoniqueContratEntreesProduction|contratEntreesProduction|canoniserContratCategorie/;
  // MISE À JOUR DÉLIBÉRÉE v0.63.57 : observation-possibilites.js (producteur de l'observation) est le SEUL importeur : il persiste la preuve telle que rendue.
  assert.deepEqual(sources.filter((f) => motif.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f).split('\\').join('/')), ['app/langage/contexte-observation.js', 'app/langage/empreinte-categorie-entrees.js', 'app/langage/empreinte-categorie-message.js', 'app/langage/observation-possibilites.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.65 : + empreinte-categorie-message.js (réutilise canoniserContratCategorie : même canonisation, non réimplémentée) ; // MISE À JOUR DÉLIBÉRÉE v0.63.58 : + contexte-observation.js (VÉRIFIE la preuve par la même source, sans rien recalculer)
  for (const f of ['resoudre-identites.js', 'connaissances.js', 'execution-sollicitee.js', 'applications-sollicitables.js', 'valeurs-application.js', 'univers-valeurs.js', 'pont.js', 'entrees-donnee.js', 'entrees-production.js', 'empreinte-contrats.js']) assert.equal(motif.test(lu('app', 'langage', f)), false, f);
  for (const autre of ['sw.js', 'worker.js', 'index.html', 'app/main.js']) { let s = ''; try { s = lu(autre); } catch { continue; } assert.equal(motif.test(s), false, autre); }
});
test('G2. PURETÉ : ni horloge, ni hasard, ni identité générée, ni magasin, ni écriture, ni asynchronisme, ni état global', () => {
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'crypto', 'setTimeout', 'require(', 'fetch']) assert.equal(CODE.includes(interdit), false, interdit);
  assert.equal(/\blet\b/.test(CODE.split('export function canoniserContratCategorie')[0].replace(/for \(let rang/g, '')), false, 'aucun état de module modifiable');
});
test('G3. AUCUN AUTRE EFFET : pas de table, de migration ni de persistance ; VERSION_BASE, schéma, catalogue (16), table d\'opérations (16) inchangés ; les empreintes d\'opérations ne connaissent pas la catégorie', () => {
  assert.equal(VERSION_BASE, 22); assert.equal(SCHEMA_SAUVEGARDE, 12); assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(C16.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(C16.some((d) => /empreinte|categorie|entrees-de/i.test(d.nom)), false);
  assert.equal(/ecrire|enregistrer/.test(CODE), false);
  assert.equal(/categorie|entrees-de-production/.test(sansCommentaires(lu('app', 'langage', 'empreinte-contrats.js'))), false);
});
test('G4. MISE À JOUR DÉLIBÉRÉE v0.63.57 + v0.63.58 : la preuve est ÉCRITE par le producteur et VÉRIFIÉE par le contexte avec la même source unique, jamais recalculée ailleurs : observation-possibilites.js en rend les symboles tels quels ; connaissances.js (validation de format) ne nomme pas le module', () => {
  const obs = sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'));
  assert.equal(/empreinteContratEntreesProduction\(\)/.test(obs), true);
  assert.equal(/canoniqueContrat|contratEntreesProduction|canoniserContratCategorie|sha256|sondes/.test(obs), false, 'ni contrat, ni canonisation, ni hachage, ni sondes recalculés ici'); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : FORME/ACCES/PREFIXE sont désormais UTILISÉS (non redéfinis) pour construire entrées(P)
  assert.equal(/empreinte-categorie-entrees|empreinteContratEntreesProduction|CATEGORIE_ENTREES_PRODUCTION/.test(sansCommentaires(lu('app', 'langage', 'connaissances.js'))), false, 'connaissances.js');
  const ctx = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
  assert.equal(/empreinteContratEntreesProduction\(\)/.test(ctx), true);
  assert.equal(/canoniqueContrat|contratEntreesProduction|canoniserContratCategorie|FORME_ENTREES|ACCES_ENTREES|PREFIXE_IDENTITE|sha256|crypto/.test(ctx), false, 'le contexte ne recalcule ni forme, ni accès, ni préfixe, ni sondes');
});
