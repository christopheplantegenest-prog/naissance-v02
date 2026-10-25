// v0.66.8 — ATELIER 2, L3 : ISOLATION des capacités en essai, et ses limites démontrées.
// Barrière 1 (analyse.js) : recherche de mots, transitive ; ce qu'elle voit et ce qu'elle ne voit pas.
// Barrière 2 (verrou.js) : realm neuf réduit au JavaScript pur ; les évasions que l'analyse ne voit pas y échouent.
// Barrière 3 (porte.js) : validation de la sortie et écriture en zone d'essai seulement (voir essais-porte.test.mjs).
// Gardes de structure : seule l'application (main.js) branche la porte ; aucun module existant ne lit la zone d'essai ; la porte n'importe
// ni l'atelier ni l'écran des capacités. Mécanisme technique, non cognitif ; aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verrouiller } from '../app/essais/verrou.js';
import { analyserSource, analyserModule, MOTS_INTERDITS } from '../app/essais/analyse.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(RACINE, 'app');
const URL_APP = pathToFileURL(`${APP}/`).href;
const lireSource = async (u) => readFileSync(new URL(u), 'utf8');
const fichiers = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiers(p) : [p]; });
const JS_APP = fichiers(APP).filter((p) => p.endsWith('.js')).map((p) => [relative(RACINE, p).split('\\').join('/'), readFileSync(p, 'utf8')]);
// preparation : code exécuté DANS le realm avant le verrou (simule les API d'un moteur : propriétés propres, accesseurs sur un prototype).
const realmVerrouille = (preparation = '') => {
  const ctx = vm.createContext({});
  if (preparation) vm.runInContext(preparation, ctx);
  const r = vm.runInContext(`(${verrouiller.toString()})(globalThis)`, ctx);
  return { ctx, restants: [...r.restants], eval: (code) => vm.runInContext(code, ctx, { timeout: 1000 }) };
};

// ------------------------------------------------------------------------------------------------ verrou
test('verrou : il ne reste que le JavaScript pur ; toute API d\'entrée-sortie, de minuterie ou de fabrication de code disparaît', () => {
  const { restants, eval: ev } = realmVerrouille(`
    Object.assign(globalThis, { fetch: () => 'réseau', setTimeout: () => 1, postMessage: () => 1, localStorage: {}, console: {} });
    const proto = Object.create(Object.getPrototypeOf(globalThis));
    Object.defineProperty(proto, 'indexedDB', { get: () => ({ open: () => 'ouvert' }), configurable: true });
    Object.setPrototypeOf(globalThis, proto);`);
  assert.deepEqual(restants, []);
  for (const nom of ['fetch', 'setTimeout', 'postMessage', 'localStorage', 'indexedDB', 'eval', 'Function', 'WebAssembly', 'Proxy', 'SharedArrayBuffer', 'Atomics', 'WeakRef', 'FinalizationRegistry', 'console']) {
    assert.equal(ev(`typeof globalThis[${JSON.stringify(nom)}]`), 'undefined', nom);
  }
  assert.equal(ev('Math.max(2, 3) + JSON.parse("[1]")[0] + [1, 2].map((x) => x * 2).length'), 6);
  assert.equal(ev('new Map([[1, 2]]).get(1)'), 2);
});
test('verrou : les évasions par accès calculé échouent (constructeurs de code neutralisés, prototypes gelés)', () => {
  const { eval: ev } = realmVerrouille();
  const essais = [
    "[].map['constr' + 'uctor']('return 1')()",
    "(function () {})['constr' + 'uctor']('return 1')()",
    "(async () => 1)['constr' + 'uctor']('return 1')",
    "(function* () {})['constr' + 'uctor']('yield 1')",
    "Object.getPrototypeOf(async function* () {})['constr' + 'uctor']('return 1')",
    "''['constr' + 'uctor']['constr' + 'uctor']('return 1')()",
  ];
  for (const code of essais) assert.throws(() => ev(code), { name: 'TypeError' }, code);
  assert.throws(() => ev("'use strict'; Array.prototype.x = 1"), { name: 'TypeError' });
  assert.throws(() => ev("'use strict'; Object.prototype.y = 1"), { name: 'TypeError' });
  assert.throws(() => ev("'use strict'; JSON.parse = () => 1"), { name: 'TypeError' });
  assert.equal(ev('[].x'), undefined);
});
test('verrou : une propriété non retirable et utile (objet) est signalée — le bac REFUSE alors de s\'exécuter ; une constante primitive ne l\'est pas', () => {
  const prep = "Object.defineProperty(globalThis, 'canalSecret', { value: { envoyer() {} }, writable: false, configurable: false }); Object.defineProperty(globalThis, 'TEMPORARY', { value: 0, writable: false, configurable: false });";
  assert.deepEqual(realmVerrouille(prep).restants, ['canalSecret']);
  const bac = readFileSync(join(APP, 'essais', 'bac.js'), 'utf8');
  const iVerrou = bac.indexOf('verrouiller(globalThis)');
  const iImport = bac.indexOf('await import(url)');
  assert.ok(iVerrou > 0 && iImport > iVerrou, 'le verrou est posé AVANT le chargement du code de la capacité');
  assert.match(bac.slice(iVerrou, iImport), /if \(restants\.length\) \{ repondre\(\{ type: 'verrou'/);
  assert.match(bac, /const repondre = globalThis\.postMessage\.bind\(globalThis\);/, 'canal de réponse capturé avant le verrou, inaccessible à la capacité');
});

// ------------------------------------------------------------------------------------------------ analyse
test('analyse : le témoin passe ; chaque mot interdit, import dynamique ou import non relatif est refusé', () => {
  assert.deepEqual(analyserSource(readFileSync(join(APP, 'essais', 'temoin-porte.js'), 'utf8')), { refus: [], imports: [] });
  for (const mot of MOTS_INTERDITS) assert.ok(analyserSource(`const a = 1; ${mot}; `).refus.includes(`mot interdit : ${mot}`), mot);
  assert.deepEqual(analyserSource('const fetcher = 1; const thenable = 2; const monWindow = 3;').refus, [], 'mots entiers seulement');
  assert.ok(analyserSource('const m = import("./x.js");').refus.includes('import dynamique interdit'));
  assert.ok(analyserSource("import x from 'https://exemple.org/x.js';").refus.includes('import refusé : https://exemple.org/x.js'));
  assert.ok(analyserSource("import { a } from 'paquet';").refus.includes('import refusé : paquet'));
  assert.deepEqual(analyserSource("import { a } from './a.js';\nexport { b } from '../b.js';").imports, ['./a.js', '../b.js']);
  assert.deepEqual(analyserSource(null).refus, ['source illisible']);
});
test('analyse : LIMITE assumée — une évasion par accès calculé n\'est pas vue par l\'analyse (elle échoue ensuite au verrou)', () => {
  const evasion = "export function executer() { const f = [].map['constr' + 'uctor']; return f('return 1')(); }";
  assert.deepEqual(analyserSource(evasion).refus, []);
  assert.throws(() => realmVerrouille().eval(evasion.replace('export ', '') + '; executer()'), { name: 'TypeError' });
});
test('analyse transitive : modules importés analysés aussi ; hors de l\'application, dans la porte, illisible : refus ; les modules cognitifs existants (écritures, prototypes) sont refusés', async () => {
  const sources = {
    'capacites-essai/a.js': "import { b } from './b.js'; export function executer() { return b(); }",
    'capacites-essai/b.js': "export function b() { return { lignes: [] }; }",
    'capacites-essai/c.js': "import { x } from '../../hors.js'; export const c = 1;",
    'capacites-essai/d.js': "import { porte } from '../essais/porte.js'; export const d = 1;",
    'capacites-essai/e.js': "import { z } from './absent.js'; export const e = 1;",
  };
  const lire = async (u) => { const k = u.slice(URL_APP.length); if (!(k in sources)) throw new Error('absent'); return sources[k]; };
  assert.deepEqual((await analyserModule(`${URL_APP}capacites-essai/a.js`, { racine: URL_APP, lireSource: lire })).refus, []);
  assert.match((await analyserModule(`${URL_APP}capacites-essai/c.js`, { racine: URL_APP, lireSource: lire })).refus.join(), /import hors de l'application/);
  assert.match((await analyserModule(`${URL_APP}capacites-essai/d.js`, { racine: URL_APP, lireSource: lire })).refus.join(), /import de la porte interdit/);
  assert.match((await analyserModule(`${URL_APP}capacites-essai/e.js`, { racine: URL_APP, lireSource: lire })).refus.join(), /absent\.js : source illisible/);
  const c = await analyserModule(`${URL_APP}langage/connaissances.js`, { racine: URL_APP, lireSource });
  assert.ok(c.refus.some((r) => /mot interdit : (async|indexedDB)/.test(r)));
  const iv = await analyserModule(`${URL_APP}langage/issues-vecues.js`, { racine: URL_APP, lireSource });
  assert.ok(iv.refus.length > 0, 'C1 écrit dans la base : jamais exécutable dans le bac');
});

// ------------------------------------------------------------------------------------------------ gardes de structure
test('structure : seul main.js importe la porte ; seules les sentinelles et le registre y sont chargés au démarrage, la porte et l\'écran à la demande', () => {
  for (const [p, c] of JS_APP) {
    if (p.startsWith('app/essais/') || p === 'app/main.js') continue;
    assert.doesNotMatch(c, /essais\/(porte|registre|sentinelle|zone|bac|verrou|analyse|ecran|temoin-porte)\.js/, `${p} ne doit pas brancher la porte`);
  }
  const main = readFileSync(join(APP, 'main.js'), 'utf8');
  const statiques = [...main.matchAll(/^import [^;]*from '(\.\/essais\/[^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(statiques, ['./essais/sentinelle.js', './essais/registre-essais.js']);
  assert.deepEqual([...main.matchAll(/import\('(\.\/essais\/[^']+)'\)/g)].map((m) => m[1]).sort(), ['./essais/ecran.js', './essais/porte.js']);
  const iOuvrir = main.indexOf('const demarrageEssais = ouvrirDemarrage();');
  const iFermer = main.indexOf('fermerDemarrage();');
  const iSignal = main.indexOf("document.documentElement.dataset.demarrage = 'ok';");
  assert.ok(iOuvrir > 0 && iOuvrir < main.indexOf('const RAPPEL_EXPORT_MS'), 'sentinelle posée avant toute initialisation');
  assert.ok(iFermer > 0 && iFermer < iSignal, 'sentinelle retirée juste avant le signal de démarrage');
  // Le code du tour n'est pas touché : seul `repondre` est enveloppé à la création de la conversation, et son résultat est rendu TEL QUEL.
  assert.match(main, /function apresTourEssais\(resultat\) \{[\s\S]*?return resultat;\n\}/);
  assert.match(main, /function avecEssaisApresTour\(options\) \{\n  return \{ \.\.\.options, repondre: async \(texte, opts\) => apresTourEssais\(await options\.repondre\(texte, opts\)\) \};\n\}/);
  assert.equal((main.match(/const conversation = monterConversation\(avecEssaisApresTour\(\{/g) || []).length, 1);
  assert.equal((main.match(/return avecIdMessage\(await apresEvenements\(/g) || []).length, 2);
  assert.equal((main.match(/apresTourEssais\(/g) || []).length, 2, 'définition + enveloppe, rien d\'autre');
});
test('structure : aucun module existant ne lit la zone d\'essai ni l\'état des essais ; la porte n\'importe ni l\'atelier, ni l\'écran des capacités, ni un module cognitif autre que la liste des tables', () => {
  for (const [p, c] of JS_APP) {
    if (p.startsWith('app/essais/')) continue;
    assert.ok(!c.includes('naissance-essais'), `${p} : aucune lecture de la zone d'essai`);
  }
  for (const [p, c] of JS_APP.filter(([x]) => x.startsWith('app/essais/'))) {
    for (const m of c.matchAll(/from '([^']+)'/g)) {
      const s = m[1];
      // MISE À JOUR DÉLIBÉRÉE v0.66.9 (ATELIER 2, L4) : la porte n'importe plus RIEN hors de app/essais/ (elle est privilégiée P1 au robot ;
      // la liste des tables est fournie par main.js) — l'exception ../langage/connaissances.js est retirée.
      assert.ok(s.startsWith('./') || s === '../memoire/transfert.js', `${p} importe ${s}`);
      assert.ok(!/atelier|capacites\//.test(s), `${p} importe ${s}`);
    }
  }
  const registre = readFileSync(join(APP, 'essais', 'registre-essais.js'), 'utf8');
  // MISE À JOUR DÉLIBÉRÉE v0.66.9 (ATELIER 2, L4) : plus aucun import cognitif dans le registre (fermeture P1 du robot limitée à app/essais/).
  assert.doesNotMatch(registre, /^import /m);
  const sauvegarde = readFileSync(join(APP, 'memoire', 'sauvegarde.js'), 'utf8');
  assert.doesNotMatch(sauvegarde, /naissance-essais|naissance-ia\.essais|essais\//, 'la sauvegarde de Naissance ignore tout des essais');
});
test('structure : écran « Capacités en essai » ouvert depuis les Réglages (entrée et section uniques, sans le mot « atelier »)', () => {
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const SECTION = '<section id="essais" class="panneau" hidden aria-label="Capacités en essai">\n    <header class="entete">\n      <button type="button" class="bouton-secondaire" data-fermer-panneau>← Retour</button>\n      <h2>Capacités en essai</h2>\n    </header>\n    <div class="contenu-reglages" data-essais-contenu></div>\n  </section>';
  const ENTREE = '<button type="button" class="bouton-secondaire" data-ouvrir-essais>Capacités en essai →</button>';
  assert.equal(html.split(SECTION).length, 2);
  assert.equal(html.split(ENTREE).length, 2);
  assert.doesNotMatch(SECTION + ENTREE, /atelier/i);
});
