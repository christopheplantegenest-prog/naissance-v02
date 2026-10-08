// === DEBUT_TEST_DONNEE_DE_SOURCE ===
// v0.63.15 — ÉTAPE 6, décision ChatGPT « DESCRIPTION DE LA SOURCE MESSAGE » (04/10/2026). Preuves que
// app/langage/donnee-de-source.js rend exactement { identite, forme } : identité = id de la source, forme = copie validée de la
// DÉCLARATION, contenu jamais lu ; que la déclaration du message (source-message.js) dit scalaire chaîne ; que la chaîne
// identifierMessage → donneeDeSource → possibilitesDeLiaison n'est assemblée QUE dans ce fichier ; et que tout reste dormant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as module from '../app/langage/donnee-de-source.js';
import * as moduleMessage from '../app/langage/source-message.js';
import { identifierMessage } from '../app/langage/pont.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const { donneeDeSource: donnee } = module;
const { DESCRIPTION_SOURCE_MESSAGE } = moduleMessage;
const RACINE = join(import.meta.dirname, '..');
const NOM = 'app/langage/donnee-de-source.js';
const NOM_MSG = 'app/langage/source-message.js';
const SRC = readFileSync(join(RACINE, NOM), 'utf8');
const SRC_MSG = readFileSync(join(RACINE, NOM_MSG), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SRC);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const gen = () => { let n = 0; return (p) => `${p}-t-${++n}`; };
const FORMES = {
  chaine: { forme: 'scalaire', genre: 'chaine' }, nombre: { forme: 'scalaire', genre: 'nombre' }, scalaire: { forme: 'scalaire' },
  objet: { forme: 'objet', champs: { a: { forme: 'scalaire', genre: 'chaine' } } },
  collection: { forme: 'collection', elements: { forme: 'scalaire' } }, quelconque: { forme: 'quelconque' },
};
const piege = () => { const o = { id: 'S1' }; Object.defineProperty(o, 'texte', { enumerable: true, get() { throw new Error('contenu lu'); } }); return o; };

// ============================================================================ A. PRIMITIVE GÉNÉRALE
test('A1. exactement un export : donneeDeSource(source, descriptionSource)', () => {
  assert.deepEqual(Object.keys(module), ['donneeDeSource']);
  assert.equal(donnee.length, 2);
});
test('A2. source identifiée + forme déclarée → { identite, forme } exactement', () => {
  const r = donnee({ id: 'S1', texte: 'x' }, { forme: FORMES.chaine });
  assert.deepEqual(Object.keys(r), ['identite', 'forme']);
  assert.deepEqual(r, { identite: 'S1', forme: FORMES.chaine });
});
test('A3. le contenu n\'est jamais inspecté : absent, null, incompatible, accesseur qui lève → même donnée', () => {
  const attendu = { identite: 'S1', forme: FORMES.chaine };
  const d = { forme: FORMES.chaine };
  for (const source of [{ id: 'S1' }, { id: 'S1', texte: null }, { id: 'S1', texte: 42 }, { id: 'S1', texte: { x: 1 } }, { id: 'S1', texte: [1] }, { id: 'S1', texte: undefined }, piege()]) {
    assert.deepEqual(donnee(source, d), attendu);
  }
});
test('A4. autres champs de la source : ignorés sans être lus (accesseur de n\'importe quel nom, Proxy sans trappe de lecture)', () => {
  const s = { id: 'S1' };
  for (const nom of ['texte', 'contenu', 'valeur', 'forme', 'identite']) Object.defineProperty(s, nom, { enumerable: true, get() { throw new Error('lu'); } });
  assert.deepEqual(donnee(s, { forme: FORMES.chaine }), { identite: 'S1', forme: FORMES.chaine });
  assert.deepEqual(donnee(Object.freeze({ id: 'S2', texte: 'a' }), { forme: FORMES.chaine }).identite, 'S2');
});
test('A5. autres champs de la déclaration : ignorés (seule « forme » compte)', () => {
  assert.deepEqual(donnee({ id: 'S1' }, { forme: FORMES.chaine, commentaire: 'x' }), { identite: 'S1', forme: FORMES.chaine });
});

// ============================================================================ B. IDENTITÉ
test('B1. identité = id, chaîne non vide, sans coercition ni trim, sans génération', () => {
  for (const id of ['a', ' a ', '  ', 'message-1-2-x', '0', 'é']) assert.equal(donnee({ id }, { forme: FORMES.chaine }).identite, id);
});
test('B2. source sans id, id vide, id non chaîne, id accesseur, id hérité, source non objet → TypeError', () => {
  const d = { forme: FORMES.chaine };
  refuse(() => donnee({}, d), /id/);
  refuse(() => donnee({ id: '' }, d), /non vide/);
  for (const id of [1, null, undefined, true, {}, [], Symbol('x'), () => 'a', new String('a')]) refuse(() => donnee({ id }, d), /chaîne non vide/);
  let lu = false;
  refuse(() => donnee({ get id() { lu = true; return 'a'; } }, d), /accesseur/);
  assert.equal(lu, false, 'l\'accesseur n\'est pas exécuté');
  refuse(() => donnee(Object.create({ id: 'h' }), d), /id/);
  for (const s of [null, undefined, 'S1', 1, [], [{ id: 'a' }]]) refuse(() => donnee(s, d), /source/);
});
test('B3. aucune génération : aucun appel de nouvelId, aucune horloge, aucun hasard dans le module', () => {
  assert.equal(/nouvelId|Date\b|Math\.random|crypto|Symbol|\+\+|\+= *1/.test(CODE), false);
});

// ============================================================================ C. FORME
test('C1. généralité : chaque forme du langage est rendue telle que déclarée (le module ne connaît pas le message)', () => {
  for (const [nom, forme] of Object.entries(FORMES)) assert.deepEqual(donnee({ id: 'X' }, { forme }), { identite: 'X', forme }, nom);
});
test('C2. forme invalide → TypeError ; fait de champ à la racine refusé ; forme absente ou accesseur refusée', () => {
  const s = { id: 'S1' };
  for (const forme of [null, undefined, 'chaine', 3, [], {}, { forme: 'texte' }, { forme: 'scalaire', genre: 'texte' }, { forme: 'scalaire', peutManquer: true }, { forme: 'scalaire', omissible: true }, { forme: 'objet', champs: { a: 1 } }]) {
    refuse(() => donnee(s, { forme }), /descriptionSource\.forme/);
  }
  refuse(() => donnee(s, {}), /forme/);
  refuse(() => donnee(s, { get forme() { throw new Error('exécuté'); } }), /accesseur/);
});
test('C3. la forme rendue est une copie indépendante : modifier la sortie ne modifie pas la déclaration, ni les appels suivants', () => {
  const declaration = { forme: { forme: 'objet', champs: { a: { forme: 'scalaire', genre: 'chaine' } } } };
  const avant = JSON.stringify(declaration);
  const r1 = donnee({ id: 'A' }, declaration);
  assert.notEqual(r1.forme, declaration.forme);
  assert.notEqual(r1.forme.champs, declaration.forme.champs);
  r1.forme.champs.a.genre = 'nombre'; r1.forme.champs.b = { forme: 'quelconque' };
  assert.equal(JSON.stringify(declaration), avant);
  const r2 = donnee({ id: 'A' }, declaration);
  assert.notEqual(r2.forme, r1.forme);
  assert.equal(JSON.stringify(r2.forme), JSON.stringify(declaration.forme));
  declaration.forme.champs.a.genre = 'booleen';
  assert.equal(r2.forme.champs.a.genre, 'chaine');
});
test('C4. la déclaration gelée du message n\'est jamais retournée par référence', () => {
  const r = donnee({ id: 'M' }, DESCRIPTION_SOURCE_MESSAGE);
  assert.notEqual(r.forme, DESCRIPTION_SOURCE_MESSAGE.forme);
  assert.equal(Object.isFrozen(r.forme), false);
  r.forme.genre = 'nombre';
  assert.equal(DESCRIPTION_SOURCE_MESSAGE.forme.genre, 'chaine');
});
test('C5. aucune forme codée dans le module : ni « chaine », ni « scalaire », ni typeof sur autre chose que les contrôles d\'entrée', () => {
  assert.equal(/chaine|scalaire|nombre|booleen|objet'|collection'|quelconque/.test(CODE), false);
  assert.equal(/typeof (source|descriptionSource)\.|typeof texte|\.texte|\btexte\b/.test(CODE), false);
});

// ============================================================================ D. MESSAGE RÉEL
test('D1. déclaration : un seul export, constante gelée en profondeur, scalaire chaîne, sans fonction', () => {
  assert.deepEqual(Object.keys(moduleMessage), ['DESCRIPTION_SOURCE_MESSAGE']);
  // MISE À JOUR DÉLIBÉRÉE v0.63.17 : `acces` ajouté (descriptif), ignoré par donneeDeSource.
  assert.deepEqual(DESCRIPTION_SOURCE_MESSAGE, { forme: { forme: 'scalaire', genre: 'chaine' }, acces: { champ: 'texte' } });
  assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_MESSAGE), true);
  assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_MESSAGE.forme), true);
  assert.equal(/function|=>|\bif\b|\bfor\b|import |typeof|\.\s*texte/.test(sansCommentaires(SRC_MSG)), false);
});
test('D2. identifierMessage → déclaration réelle → donneeDeSource : exactement une donnée { identite: message.id, forme: scalaire chaîne }', () => {
  const message = identifierMessage('Quel est mon nom ?', { nouvelId: gen() });
  const r = donnee(message, DESCRIPTION_SOURCE_MESSAGE);
  assert.deepEqual(r, { identite: message.id, forme: { forme: 'scalaire', genre: 'chaine' } });
  assert.deepEqual(Object.keys(r), ['identite', 'forme']);
});

// ============================================================================ E. TEXTE TROMPEUR
test('E1. "", "123", "null", JSON, texte d\'objet, espaces, saut de ligne : toujours scalaire chaîne', () => {
  for (const texte of ['', '123', 'null', 'true', '{"a":1}', '[1,2]', '{ id: 1 }', '   ', '\n', 'undefined', '0']) {
    const m = identifierMessage(texte, { nouvelId: gen() });
    assert.deepEqual(donnee(m, DESCRIPTION_SOURCE_MESSAGE).forme, { forme: 'scalaire', genre: 'chaine' }, JSON.stringify(texte));
  }
});

// ============================================================================ F. FORME MENSONGÈRE
test('F1. une déclaration papier « nombre » sur un message texte donne forme nombre (confiance au contrat, aucune vérification)', () => {
  const m = identifierMessage('bonjour', { nouvelId: gen() });
  assert.deepEqual(donnee(m, { forme: FORMES.nombre }).forme, { forme: 'scalaire', genre: 'nombre' });
  assert.deepEqual(donnee(m, { forme: FORMES.objet }).forme, FORMES.objet);
});

// ============================================================================ G. COPIES / APPELS
test('G1. appels multiples indépendants, aucun état gardé, entrées non modifiées', () => {
  const source = Object.freeze({ id: 'S1', texte: 't' });
  const decl = DESCRIPTION_SOURCE_MESSAGE;
  const a = donnee(source, decl); const b = donnee(source, decl);
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a.forme, b.forme);
  const autre = donnee({ id: 'S2' }, { forme: FORMES.nombre });
  assert.deepEqual(donnee(source, decl), a, 'un appel intermédiaire n\'a rien changé');
  assert.equal(autre.forme.genre, 'nombre');
  assert.equal(/^(let|var) |^const \w+ = (new )?(Map|Set|\[|\{)/m.test(CODE), false, 'aucun état de module');
});

// ============================================================================ H. AUCUN EFFET
test('H1. aucune persistance, aucune modification du message, aucun accès global', () => {
  const m = identifierMessage('texte', { nouvelId: gen() });
  const avant = JSON.stringify(m);
  donnee(m, DESCRIPTION_SOURCE_MESSAGE);
  assert.equal(JSON.stringify(m), avant);
  assert.equal(Object.isFrozen(m), true);
  assert.equal(/localStorage|indexedDB|connaissances|magasin|ecrire|fetch|process|globalThis|window|document/.test(CODE), false);
});

// ============================================================================ INTÉGRATION PAPIER (tests uniquement)
test('I1. identifierMessage → donneeDeSource → possibilitesDeLiaison avec les descriptions actuelles : le résultat RÉEL est DEUX atomes : message → parcourirStructure.valeur et message → symbolesDeChaine.chaine', () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38 : symbolesDeChaine décrite
  const m = identifierMessage('Quel est mon nom ?', { nouvelId: gen() });
  const d = donnee(m, DESCRIPTION_SOURCE_MESSAGE);
  const atomes = possibilitesDeLiaison([d], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(atomes, [
    { donnee: m.id, operation: 'parcourirStructure', entree: 'valeur' },
    { donnee: m.id, operation: 'symbolesDeChaine', entree: 'chaine' },
  ]);
});
test('I2. le résultat ne dépend pas du texte (mêmes atomes pour "", "123", JSON)', () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38
  for (const texte of ['', '123', '{"a":1}']) {
    const m = identifierMessage(texte, { nouvelId: gen() });
    const atomes = possibilitesDeLiaison([donnee(m, DESCRIPTION_SOURCE_MESSAGE)], DESCRIPTIONS_OPERATIONS);
    assert.deepEqual(atomes.map((a) => [a.operation, a.entree]), [['parcourirStructure', 'valeur'], ['symbolesDeChaine', 'chaine']]);
  }
});
test('I3. une déclaration papier « collection » sur un message texte change les atomes (la forme vient de la déclaration seule, jamais du texte)', () => {
  const m = identifierMessage('bonjour', { nouvelId: gen() });
  const reel = possibilitesDeLiaison([donnee(m, DESCRIPTION_SOURCE_MESSAGE)], DESCRIPTIONS_OPERATIONS).map((a) => `${a.operation}.${a.entree}`);
  const papier = possibilitesDeLiaison([donnee(m, { forme: FORMES.collection })], DESCRIPTIONS_OPERATIONS).map((a) => `${a.operation}.${a.entree}`);
  assert.deepEqual(reel, ['parcourirStructure.valeur', 'symbolesDeChaine.chaine']); // MISE À JOUR DÉLIBÉRÉE v0.63.38
  assert.deepEqual(papier, ['couvrirSequence.elements', 'parcourirStructure.valeur']);
});

// ============================================================================ NÉGATIF
test('N1. sans déclaration de source : aucune donnée inventée, aucun repli « message = chaîne »', () => {
  const m = identifierMessage('bonjour', { nouvelId: gen() });
  for (const declaration of [undefined, null, {}, { forme: undefined }, 'chaine', []]) refuse(() => donnee(m, declaration));
  refuse(() => donnee(m));
  assert.equal(/\?\?|\|\| *\{|= *\{ *forme|defaut|repli|fallback/i.test(CODE), false);
});

// ============================================================================ STATIQUE / DORMANCE
test('S1. exports uniques, aucune fonction exportée en plus, imports : seulement le langage de formes', () => {
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function donneeDeSource(source, descriptionSource) {']);
  assert.deepEqual(CODE.match(/^\s*import\b[^;]*;/gm).map((l) => l.trim()), ["import { validerDescripteurOperation } from './formes-operation.js';"]);
  assert.equal(/garantie-forme|descriptions-operations|catalogue|productions-decrites|possibilites-liaison|parcours-structure|pont\.js/.test(CODE), false);
});
test('S2. aucun fichier de production ne référence ces deux modules ni leurs exports (ni sw, worker, index, manifeste)', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f);
    if (r === NOM || r === NOM_MSG || r === 'app/langage/observation-possibilites.js') continue; // v0.63.16 : seul importeur (gardé par tests/observations-possibilites.test.mjs)
    // MISE À JOUR DÉLIBÉRÉE v0.63.48 : resoudre-identites.js (dormant, jamais importé, gardé par tests/resoudre-identites.test.mjs) réutilise donneeDeSource et
    // DESCRIPTION_SOURCE_MESSAGE pour rendre la même représentation de message que observerPossibilites.
    // MISE À JOUR DÉLIBÉRÉE v0.63.65 : empreinte-categorie-message.js (dormant, jamais importé hors de la preuve) lit donneeDeSource et DESCRIPTION_SOURCE_MESSAGE pour empreinter le contrat de
    // représentation de la catégorie message avec la source unique (gardé par tests/empreinte-categorie-message.test.mjs).
    if (r === 'app/langage/empreinte-categorie-message.js') { assert.equal(/from '\.\/donnee-de-source\.js'/.test(readFileSync(f, 'utf8')), true); continue; }
    if (r === 'app/langage/resoudre-identites.js') { assert.equal(/from '\.\/donnee-de-source\.js'/.test(readFileSync(f, 'utf8')), true); continue; }
    const src = readFileSync(f, 'utf8');
    assert.equal(/donnee-de-source|donneeDeSource|source-message|DESCRIPTION_SOURCE_MESSAGE/.test(src), false, r);
  }
  for (const autre of ['app/index.html', 'app/sw.js', 'sw.js', 'worker.js', 'index.html', 'app/manifest.webmanifest']) {
    let src; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; }
    assert.equal(/donnee-de-source|source-message/.test(src), false, autre);
  }
});
test('S3. la déclaration n\'importe rien ; le tour (pont.js, main.js) ne connaît ni la primitive ni la déclaration ni le langage de formes', () => {
  assert.equal(/^\s*import\b/m.test(sansCommentaires(SRC_MSG)), false);
  for (const n of ['app/langage/pont.js', 'app/main.js', 'app/langage/ecran.js']) {
    assert.equal(/donnee-de-source|donneeDeSource|source-message|possibilitesDeLiaison|productionsDecrites/.test(readFileSync(join(RACINE, n), 'utf8')), false, n);
  }
});
test('S4. (état v0.63.15 conservé par ce module) la persistance de ce module : aucune ; tables 19, VERSION_BASE 15, SCHEMA_SAUVEGARDE 5 depuis v0.63.16', async () => {
  const connaissances = await import('../app/langage/connaissances.js');
  assert.equal(connaissances.TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  const cs = readFileSync(join(RACINE, 'app', 'langage', 'connaissances.js'), 'utf8');
  assert.match(cs, /VERSION_BASE\s*=\s*22\b/); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentesProspectives (21 / 11 / 24) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contextesProspectifs (20 / 10 / 23) // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  const tout = fichiersJs(join(RACINE, 'app')).map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.match(tout, /SCHEMA_SAUVEGARDE\s*=\s*12\b/); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentesProspectives (21 / 11 / 24) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contextesProspectifs (20 / 10 / 23) // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
});
test('S5. le module ne contient ni dispatch, ni sélection, ni score, ni stockage, ni exécution', () => {
  assert.equal(/switch|score|priorite|choisir|selection|curiosite|apprend|registre|stocker|executer|await|async/i.test(CODE), false);
});
// === FIN_TEST_DONNEE_DE_SOURCE ===
