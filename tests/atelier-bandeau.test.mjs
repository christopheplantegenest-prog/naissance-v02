// v0.65.17 — AT-10.5.1 « BANDEAU ROUGE COLLANT » (dette UX 1 ; GO « AT-10.5.1 — GO RÉALISATION LOCALE », 21/10/2026). OUTILLAGE NON COGNITIF.
// Le bandeau est coupé en deux blocs consécutifs : tête collante compacte (version, titres, avertissement, mode, témoin) puis consignes
// non collantes (prochaine étape, avertissement AUTO, message). Ordre et texte de lecture inchangés (empreintes T5.2 des 5 D3 et de
// e7ee7e87 : tests/atelier-auto-decision.test.mjs). Garde : tête plus haute que la moitié de l'écran => non collante. Mesures Chromium
// à 390 × 850 : travail/AT-10.5.1/ (hors suite : aucun navigateur dans la suite).
// Correction C1 (GO ChatGPT 21/10/2026, après le contrôle avant dépôt) : un message d'ERREUR actif du bandeau se lit juste après la tête,
// dans son propre bloc collant « bandeau-erreur » (sous la tête collante, ou en haut de l'écran quand la garde a libéré la tête) ; il est
// vu sans défilement où que soit le geste. Le message ordinaire (restauration) reste dans les consignes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monterEcran, conduire, VERSION_BASE } from './atelier-aide.mjs';
import { canonique, decouper, etatDurableDe } from '../app/atelier/journal.js';

const textes = (e) => [e._texte, ...e.children.flatMap(textes)].filter(Boolean);
const nom = (e) => e.attrs['data-atelier'];
const TITRES = ['ATELIER DE DÉVELOPPEMENT', 'OUTILLAGE NON COGNITIF', 'Rien ici n\'est une acquisition de Naissance.'];
const TEMOIN = ['CHANTIER TÉMOIN', 'Démonstration — aucun développement réel.'];

// Contrôle commun : tête = version, titres, avertissement, mode, témoin éventuel ; consignes juste après, dans l'enveloppe ;
// la suite des textes (tête puis consignes) est exactement l'ordre de lecture du bandeau v0.65.16 ; seule exception (C1) : une erreur
// active du bandeau se lit à la fin de la tête, avant les consignes.
function verifier(a, { mode, temoin, auto, message, erreur }) {
  const tete = a.un('bandeau');
  const env = tete.parent;
  assert.equal(env.className, 'atelier-bandeau-enveloppe');
  assert.equal(env.parent, a.zone);
  assert.equal(a.zone.children[0], env, 'le bandeau reste en tête de l\'écran');
  assert.equal(tete.className, 'atelier-bandeau');
  assert.equal(tete.attrs['data-collant'], 'oui');
  assert.equal(tete.children[0], a.un('version-apk'));
  const consignes = a.un('bandeau-consignes');
  const blocErreur = a.trouver('bandeau-erreur');
  assert.equal(blocErreur.length, erreur ? 1 : 0);
  assert.deepEqual(env.children, [tete, ...blocErreur, consignes]);
  for (const n of ['prochaine-etape', 'auto-bandeau', 'message']) assert.ok(a.trouver(n).every((x) => !contient(tete, x)), `${n} hors de la tête`);
  if (erreur) {
    assert.equal(blocErreur[0].className, 'atelier-bandeau-erreur');
    assert.equal(blocErreur[0].children.length, 1);
    const m = blocErreur[0].children[0];
    assert.equal(nom(m), 'message', 'l\'erreur est seule dans son bloc, juste après la tête');
    assert.equal(m.textContent, erreur);
    assert.match(m.className, /resultat-erreur/);
    assert.equal(a.trouver('message').length, 1);
  }
  assert.deepEqual(consignes.children.map(nom), ['prochaine-etape', ...(auto ? ['auto-bandeau'] : []), ...(message ? ['message'] : [])]);
  const attendu = [`Naissance v${VERSION_BASE}`, ...TITRES, `Mode : ${mode}`, 'OFF', 'MANUEL', 'AUTO', ...(temoin ? TEMOIN : []), ...(erreur ? [erreur] : []),
    a.un('prochaine-etape').textContent, ...(auto ? [a.un('auto-bandeau').textContent] : []), ...(message ? [message] : [])];
  assert.deepEqual(textes(env), attendu);
  assert.deepEqual(a.texte().split('\n').slice(0, attendu.length), attendu);
  assert.ok(a.un('prochaine-etape').textContent.startsWith('Prochaine étape : '));
}
const contient = (p, x) => p === x || p.children.some((c) => contient(c, x));

test('AT-10.5.1 atelier vide (OFF) : tête et consignes, ordre de lecture inchangé', () => {
  const a = monterEcran({ version: VERSION_BASE });
  verifier(a, { mode: 'OFF', temoin: false, auto: false });
});
test('AT-10.5.1 OFF, MANUEL, AUTO sur un chantier témoin en cours : le témoin reste dans la tête, l\'avertissement AUTO dans les consignes', async () => {
  const a = await conduire('lancee-sauvegardee');
  verifier(a, { mode: 'MANUEL', temoin: true, auto: false });
  await a.cliquer('mode-off');
  verifier(a, { mode: 'OFF', temoin: true, auto: false });
  await a.cliquer('mode-auto');
  verifier(a, { mode: 'AUTO', temoin: true, auto: true });
  assert.ok(a.un('auto-bandeau').textContent.startsWith('Mode AUTO'));
});
test('AT-10.5.1 restauration : le message de réussite est dans les consignes, en OFF, MANUEL et AUTO', async () => {
  const source = await conduire('rendue');
  const texte = canonique(etatDurableDe(source.copie()));
  const a = monterEcran({ version: VERSION_BASE });
  await a.cliquer('mode-manuel');
  for (const p of decouper(texte, JSON.parse(texte).chantier)) { a.saisir('partie-restauration', p); await a.cliquer('ajouter-partie'); }
  await a.cliquer('confirmer-restauration');
  const message = a.un('message').textContent;
  assert.match(message, /^Chantier « .+ » restauré \(empreinte [0-9a-f]{16}…\)\./);
  verifier(a, { mode: 'OFF', temoin: true, auto: false, message });
  await a.cliquer('mode-manuel');
  verifier(a, { mode: 'MANUEL', temoin: true, auto: false, message });
  await a.cliquer('mode-auto');
  verifier(a, { mode: 'AUTO', temoin: true, auto: true, message });
});
// MISE À JOUR DÉLIBÉRÉE v0.65.17 (correction C1, GO ChatGPT 21/10/2026 : l'erreur placée dans les consignes défilait hors de l'écran
// après un geste plus bas sur la page ; elle est désormais dans son propre bloc collant, juste après la tête).
const PANNE = 'Copie locale non enregistrée sur cet appareil.';
test('AT-10.5.1 C1 copie locale non enregistrée : l\'erreur est dans son bloc collant après la tête, en OFF, MANUEL et AUTO, et le reste à chaque nouveau rendu', async () => {
  const a = await conduire('en-cours');
  a.stockage.panne = true;
  await a.cliquer('mode-auto');
  verifier(a, { mode: 'AUTO', temoin: true, auto: true, erreur: PANNE });
  await a.cliquer('mode-off');
  verifier(a, { mode: 'OFF', temoin: true, auto: false, erreur: PANNE });
  await a.cliquer('mode-manuel');
  verifier(a, { mode: 'MANUEL', temoin: true, auto: false, erreur: PANNE });
  a.ecran.rafraichir();
  verifier(a, { mode: 'MANUEL', temoin: true, auto: false, erreur: PANNE });
});
test('AT-10.5.1 C1 scénario réel : atelier vide, MANUEL, stockage en panne, « + jalon » => erreur dans le bloc collant, au 1er et au 2e geste', async () => {
  const a = monterEcran({ version: VERSION_BASE });
  await a.cliquer('mode-manuel');
  a.stockage.panne = true;
  await a.cliquer('ajouter-jalon');
  verifier(a, { mode: 'MANUEL', temoin: false, auto: false, erreur: PANNE });
  await a.cliquer('ajouter-jalon');
  verifier(a, { mode: 'MANUEL', temoin: false, auto: false, erreur: PANNE });
});
test('AT-10.5.1 C1 comportement préexistant documenté (non modifié) : un message de section posé après l\'échec remplace l\'erreur ; aucun bloc d\'erreur', async () => {
  const a = monterEcran({ version: VERSION_BASE });
  await a.cliquer('mode-manuel');
  a.stockage.panne = true;
  await a.cliquer('temoin');
  const tete = a.un('bandeau');
  assert.equal(a.trouver('message').length, 1);
  const m = a.un('message');
  assert.ok(!contient(tete, m), 'le message de section n\'est pas dans la tête');
  assert.ok(!contient(a.un('bandeau').parent, m), 'ni dans les consignes');
  assert.match(m.textContent, /^Chantier TÉMOIN prérempli\./);
  assert.equal(a.trouver('bandeau-erreur').length, 0);
  assert.equal(tete.children[tete.children.length - 1].attrs['data-atelier'], 'temoin-bandeau');
});
test('AT-10.5.1 garde : tête plus haute que la moitié de l\'écran => non collante ; revient collante sinon ; s\'arrête une fois retirée', () => {
  const avant = [globalThis.ResizeObserver, globalThis.innerHeight];
  const gardes = [];
  globalThis.ResizeObserver = class { constructor(f) { this.f = f; this.cibles = []; this.coupe = false; gardes.push(this); } observe(c) { this.cibles.push(c); } disconnect() { this.coupe = true; } };
  try {
    const a = monterEcran({ version: VERSION_BASE });
    const tete = a.un('bandeau');
    const g = gardes.find((x) => x.cibles.includes(tete));
    assert.ok(g, 'la tête est observée');
    globalThis.innerHeight = 850;
    tete.isConnected = true;
    tete.offsetHeight = 426; g.f();
    assert.equal(tete.attrs['data-collant'], 'non');
    tete.offsetHeight = 425; g.f();
    assert.equal(tete.attrs['data-collant'], 'oui');
    tete.isConnected = false; tete.offsetHeight = 900; g.f();
    assert.equal(tete.attrs['data-collant'], 'oui');
    assert.equal(g.coupe, true);
  } finally { [globalThis.ResizeObserver, globalThis.innerHeight] = avant; }
});
test('AT-10.5.1 C1 garde avec erreur : tête + erreur comptées ensemble ; l\'erreur se colle sous la tête collante, sinon en haut de l\'écran', async () => {
  const avant = [globalThis.ResizeObserver, globalThis.innerHeight];
  const gardes = [];
  globalThis.ResizeObserver = class { constructor(f) { this.f = f; this.cibles = []; this.coupe = false; gardes.push(this); } observe(c) { this.cibles.push(c); } disconnect() { this.coupe = true; } };
  try {
    const a = await conduire('en-cours');
    a.stockage.panne = true;
    await a.cliquer('mode-auto');
    const tete = a.un('bandeau');
    const erreur = a.un('bandeau-erreur');
    const g = gardes.find((x) => x.cibles.includes(tete));
    assert.ok(g && g.cibles.includes(erreur), 'la tête et l\'erreur sont observées');
    globalThis.innerHeight = 850;
    tete.isConnected = true;
    tete.offsetHeight = 300; erreur.offsetHeight = 125; g.f();
    assert.equal(tete.attrs['data-collant'], 'oui');
    assert.equal(erreur.attrs.style, 'top: 300px');
    erreur.offsetHeight = 126; g.f();
    assert.equal(tete.attrs['data-collant'], 'non');
    assert.equal(erreur.attrs.style, 'top: 0px');
  } finally { [globalThis.ResizeObserver, globalThis.innerHeight] = avant; }
});
test('AT-10.5.1 styles.css : seules la tête et l\'erreur sont collantes, aucun défilement interne, garde « data-collant » et enveloppe sans boîte', () => {
  const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, d]) => [s.trim().replace(/^\/\*[\s\S]*?\*\/\s*/, ''), d]);
  const de = (sel) => regles.filter(([s]) => s === sel).map(([, d]) => d).join(';');
  assert.match(de('.atelier-bandeau'), /position:\s*sticky/);
  assert.match(de('.atelier-bandeau[data-collant="non"]'), /position:\s*static/);
  assert.match(de('.atelier-bandeau-enveloppe'), /display:\s*contents/);
  assert.match(de('.atelier-bandeau-erreur'), /position:\s*sticky/);
  assert.match(de('.atelier-bandeau-erreur'), /background:\s*var\(--fond\)/);
  for (const [s, d] of regles.filter(([s]) => s.includes('atelier-bandeau'))) {
    assert.doesNotMatch(d, /overflow|max-height/, `aucun défilement interne : ${s}`);
    if (s !== '.atelier-bandeau' && s !== '.atelier-bandeau-erreur') assert.doesNotMatch(d, /sticky/, `seules la tête et l'erreur sont collantes : ${s}`);
  }
  assert.match(de('.atelier-bandeau-consignes'), /border:\s*2px solid var\(--erreur\)/);
});
