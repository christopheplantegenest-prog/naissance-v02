// v0.64.30 — OUTIL-1 « COPIER LE DIAGNOSTIC » (GO ChatGPT « GO DÉVELOPPEMENT OUTIL-1 v0.64.30 », 16/10/2026).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Le bouton sérialise la représentation DÉJÀ CONSTRUITE du panneau Diagnostic
// (sous-blocs repliés compris ; section paresseuse jamais ouverte marquée) et l'écrit dans le presse-papiers. Gardes : état du panneau
// identique avant / après le geste (hors libellé du bouton), zéro lecture ou recalcul, aucun faux « Copié ✓ », aucun ajout au texte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/conversation/texte-diagnostic.js';
import { texteDiagnostic, CLASSE_PARESSEUSE, MARQUE_NON_OUVERTE } from '../app/conversation/texte-diagnostic.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
function fichiersJs(d) { return readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : (p.endsWith('.js') ? [p] : []); }); }

// ------------------------------------------------------------------------------------------------ DOM factice (forme du DOM réel lue par le module)
class Faux {
  get parentNode() { return this.parent; }
  get textContent() { return this._texte; }
  set textContent(v) { this._texte = String(v); this.children = []; } // comme le DOM réel : affecter le texte remplace les enfants
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.attrs = {}; this.open = false; this.type = ''; this.title = ''; }
  get tagName() { return this.tag.toUpperCase(); }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c, ref) { if (c.parent) c.remove(); c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(sel) { const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, '')); const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; }; return parcourir(this); }
}
const el = (tag, texte = '', ...enfants) => { const e = new Faux(tag); e.textContent = texte; e.append(...enfants); return e; };
const noeudTexte = (t) => ({ nodeType: 3, textContent: t });
const trouver = (e, f) => (f(e) ? e : (e.children || []).map((c) => trouver(c, f)).find(Boolean) || null);
// Photographie COMPLÈTE de l'état d'un sous-arbre (toutes les propriétés d'état, récursivement).
const photo = (e) => ({ tag: e.tag, cls: e.className, texte: e.textContent, open: e.open, disabled: e.disabled, hidden: e.hidden, attrs: { ...e.attrs }, enfants: e.children.map(photo) });
const textesArbre = (e) => [e.textContent, ...(e.children || []).flatMap(textesArbre)].filter((x) => typeof x === 'string' && x.trim());

async function ecranAvec(capacite, copier) {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  globalThis.window = globalThis;
  const { monterConversation } = await import('../app/conversation/ecran.js');
  const page = new Faux('main'); const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  page.append(liste, formulaire);
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: async () => ({ texte: 'ok' }), capacite, ...(copier ? { copier } : {}) });
  await conv.recharger();
  const zone = page.children.find((c) => c._cls.has('diagnostic'));
  const boutonCopier = trouver(zone, (e) => e.tag === 'button' && e._cls.has('bouton-copier-diagnostic'));
  const section = trouver(zone, (e) => e._cls.has('attentes-conditionnees-zone'));
  return { page, zone, boutonCopier, section };
}
const cliquer = (b) => Promise.all(b.listeners.click.map((f) => f()));

// Un pont capacité réaliste, chaque lecture comptée.
function pontCompte() {
  const appels = {};
  const compte = (nom, f) => async (...a) => { appels[nom] = (appels[nom] || 0) + 1; return f(...a); };
  const capacite = {
    lire: compte('lire', () => ({ valeur: 2, plafond: 3, derniere: { cause: { type: 'tour', id: 'observation-1' }, valeur: 2 }, relation: { valeur: 1, plafond: 3, derniere: null }, besoins: [{ besoin: 'capacite', valeurActuelle: 2, satiete: 3, motif: true, satisfactionsSansProduction: [], moyens: [{ production: 'execution-P1', operation: 'soi:repos', preuves: [{ reception: 'reception-1', emission: 'emission-1', valeurAvant: 1, valeurApres: 2 }] }], strategies: [] }] })),
    repos: compte('repos', () => ({})),
    experiencesSituees: compte('experiencesSituees', () => []),
    dernierEvenement: compte('dernierEvenement', () => null),
    dernierEpisode: compte('dernierEpisode', () => null),
    attentesConditionnees: compte('attentesConditionnees', () => ({ attentes: [{ occurrence: { idAttente: 'attente-A', horodatage: '2026-10-16T10:00:00.000Z', idObservation: 'observation-1' }, acte: { idActe: 'observation-1', table: 'observations', operation: 'soi:tour' }, avantIssue: { statut: 'ecrit-avant-issue', relation: { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: { valeurs: { arrivee: 1 } } }, reconnaissance: { formulationsAnterieures: [{ idAttente: 'attente-Z', temoins: 'differents' }], nonComparees: [] }, chemin: ['valeurs', 'arrivee'], constat: { type: 'nombre', valeur: 1 }, fondation: [{ conditions: [{ chemin: ['valeurs', 'depart'], type: 'nombre', valeur: 2 }], couverture: [['a'], ['b']], constats: [], temoinUnique: false }], idContexte: 'c' } }], illisibles: [] })),
    issuesAujourdhui: compte('issuesAujourdhui', () => [{ idAttente: 'attente-A', aujourdhui: { issues: [{ idExecution: 'e1', horodatageExecution: '2026-10-16T11:00:00.000Z', statut: 'realisee', reel: { type: 'nombre', valeur: 1 } }] } }]),
  };
  return { capacite, appels };
}

// ================================================================================================================ O1 module
test('O1. MODULE : pur, sans aucun import ; trois exports exacts ; importé par le seul écran de conversation', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['CLASSE_PARESSEUSE', 'MARQUE_NON_OUVERTE', 'texteDiagnostic']);
  const code = sansCommentaires(lu('app', 'conversation', 'texte-diagnostic.js'));
  assert.doesNotMatch(code, /^\s*import\b|\bimport\(/m, 'aucun import');
  assert.doesNotMatch(code, /magasin|lireTout|ecrire|enregistrer|capacite|navigator|document\.|setTimeout|Date|Math\.random|\.open\s*=|dispatchEvent|click\(/);
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /from '\.\/texte-diagnostic\.js'|texte-diagnostic\.js'/.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f));
  assert.deepEqual(importeurs, [join('app', 'conversation', 'ecran.js')]);
  assert.throws(() => texteDiagnostic(null), TypeError);
});

// ================================================================================================================ O2 sérialisation
test('O2. TEXTE : titres, lignes, blocs repliés COMPRIS, retrait par bloc, boutons ignorés, nœuds texte ; arbre GELÉ (aucune écriture) ; rien d\'ajouté', () => {
  const replie = el('details', '', el('summary', 'détail des moyens'), el('div', 'production P1'), el('div', '   preuve : réception R1'));
  assert.equal(replie.open, false);
  const imbrique = el('details', '', el('summary', 'interne'), el('div', 'ligne interne'));
  const bloc = el('div', '', el('div', 'ligne de bloc'), imbrique);
  const emission = el('div', '', el('span', 'Naissance → toi : bonjour'), el('button', 'Répondre'));
  const mixte = el('div'); mixte.children.push(noeudTexte('texte nu'), noeudTexte('   '), { nodeType: 8, textContent: 'commentaire ignoré' });
  const vide = el('details', '', el('summary', 'liste vide'));
  const racine = el('details', '', el('summary', 'Diagnostic'), el('button', 'Copier le diagnostic'), el('div', 'capacité c = 2 / plafond 3'), el('div', ''), replie, bloc, emission, mixte, vide);
  const geler = (e) => { if (e instanceof Faux) { Object.freeze(e.children); e.children.forEach(geler); Object.freeze(e); } return e; };
  geler(racine);
  const texte = texteDiagnostic(racine);
  assert.equal(texte, [
    'Diagnostic',
    'capacité c = 2 / plafond 3',
    'détail des moyens',
    '  production P1',
    '     preuve : réception R1',
    'ligne de bloc',
    'interne',
    '  ligne interne',
    'Naissance → toi : bonjour',
    'texte nu',
    'liste vide',
  ].join('\n'));
  assert.doesNotMatch(texte, /Copier le diagnostic|Répondre/, 'les libellés de boutons ne sont pas du contenu');
  assert.ok(!texte.includes(MARQUE_NON_OUVERTE), 'un bloc ordinaire sans ligne n\'est PAS une section non ouverte');
});

test('O3. SECTION PARESSEUSE : jamais construite → « (section non ouverte) » ; construite puis refermée → son contenu, sans marque ; jamais ouverte par la sérialisation', () => {
  const jamais = el('details', '', el('summary', 'Attentes conditionnées écrites avant leur issue'));
  jamais.classList.add(CLASSE_PARESSEUSE);
  const construite = el('details', '', el('summary', 'Attentes conditionnées écrites avant leur issue'), el('div', '', el('button', 'Relire les issues aujourd\'hui'), el('details', '', el('summary', 'observation …1 · soi:tour'), el('div', 'attente …A'))));
  construite.classList.add(CLASSE_PARESSEUSE);
  const t1 = texteDiagnostic(el('details', '', el('summary', 'D'), jamais));
  assert.equal(t1, ['D', 'Attentes conditionnées écrites avant leur issue', `  ${MARQUE_NON_OUVERTE}`].join('\n'));
  const t2 = texteDiagnostic(el('details', '', el('summary', 'D'), construite));
  assert.equal(t2, ['D', 'Attentes conditionnées écrites avant leur issue', '  observation …1 · soi:tour', '    attente …A'].join('\n'));
  assert.equal(jamais.open, false); assert.equal(construite.open, false);
});

// ================================================================================================================ O4 écran réel
test('O4. ÉCRAN — GARDE CRITIQUE : état du panneau identique avant / après le geste (hors libellé du bouton) ; ZÉRO lecture ou recalcul ; sous-blocs repliés copiés ; section paresseuse non ouverte ; « Copié ✓ » après réussite', async () => {
  const { capacite, appels } = pontCompte();
  const copies = [];
  const { zone, boutonCopier, section } = await ecranAvec(capacite, async (t) => { copies.push(t); });
  assert.ok(boutonCopier, 'bouton monté');
  assert.equal(boutonCopier.textContent, 'Copier le diagnostic');
  assert.equal(zone.children[0].tag, 'summary'); assert.equal(zone.children[1], boutonCopier, 'en tête du panneau, sous son titre');
  assert.equal(zone.open, false, 'panneau replié');
  const appelsAvant = { ...appels };
  const avant = photo(zone);
  await cliquer(boutonCopier);
  assert.deepEqual(appels, appelsAvant, 'aucune lecture, aucun recalcul, aucune relecture des issues');
  assert.equal(appels.attentesConditionnees, undefined, 'la section paresseuse n\'a jamais été chargée');
  assert.equal(boutonCopier.textContent, 'Copié ✓');
  const apres = photo(zone);
  const sansBouton = (p) => JSON.parse(JSON.stringify(p), (k, v) => (v && v.cls === 'lien-action bouton-copier-diagnostic' ? { ...v, texte: '(libellé du bouton)' } : v));
  assert.deepEqual(sansBouton(apres), sansBouton(avant), 'aucun open, aucune classe, aucun texte, aucun enfant modifié');
  assert.equal(copies.length, 1);
  const t = copies[0];
  assert.ok(t.startsWith('Diagnostic : besoins, moyens connus, dernier épisode propre\ncapacité c = 2 / plafond 3'));
  assert.match(t, /\n {2}production execution-P1 \(soi:repos\) — 1 preuve\n/, 'contenu d\'un dépliant REPLIÉ copié');
  assert.match(t, /preuve : réception reception-1 — émission emission-1 — 1 → 2/);
  assert.match(t, /\nAttentes conditionnées écrites avant leur issue\n {2}\(section non ouverte\)/);
  assert.doesNotMatch(t, /Copier le diagnostic|Copié|Repos\b/);
  assert.equal(section.open, false);
  // AUCUN AJOUT : chaque ligne copiée (sans retrait) est le texte d'un nœud déjà construit, ou la seule marque de section non ouverte.
  const construits = new Set(textesArbre(zone));
  const sansRetrait = (ligne) => Array.from({ length: 8 }, (_, r) => ligne.slice(2 * r)).filter((x, r) => ligne.slice(0, 2 * r).trim() === '');
  for (const ligne of t.split('\n')) assert.ok(sansRetrait(ligne).some((x) => construits.has(x) || x === MARQUE_NON_OUVERTE), `ligne ajoutée : « ${ligne} »`);
  // le geste est répétable, toujours sans lecture
  await cliquer(boutonCopier);
  assert.deepEqual(appels, appelsAvant);
  assert.equal(copies[1], copies[0]);
});

test('O5. ÉCRAN : section déjà chargée (y compris issues relues) puis REFERMÉE → copiée telle qu\'elle est construite, sans nouvelle lecture', async () => {
  const { capacite, appels } = pontCompte();
  const copies = [];
  const { boutonCopier, section } = await ecranAvec(capacite, async (t) => { copies.push(t); });
  section.open = true; await Promise.all(section.listeners.toggle.map((f) => f()));
  await cliquer(trouver(section, (e) => e.tag === 'button' && e.textContent === 'Relire les issues aujourd\'hui'));
  section.open = false; await Promise.all(section.listeners.toggle.map((f) => f()));
  const appelsAvant = { ...appels };
  assert.equal(appelsAvant.attentesConditionnees, 1); assert.equal(appelsAvant.issuesAujourdhui, 1);
  await cliquer(boutonCopier);
  assert.deepEqual(appels, appelsAvant, 'zéro lecture déclenchée par la copie');
  const t = copies[0];
  assert.doesNotMatch(t, /section non ouverte/);
  assert.match(t, /relation persistée : domaine soi:tour\(etat\) · connu .*depart.*2.* · attendu .*arrivee.*1/);
  assert.match(t, /FORMULATIONS ANTÉRIEURES RECONNUES À K0\n.*- attente attente-Z · épisodes témoins différents/);
  assert.match(t, /RELU AUJOURD'HUI — avec le magasin et le code actuels\n.*issue \(2026-10-16 11:00:00, exécution e1\) : réalisée — réel : nombre 1/);
  assert.match(t, /fondation : 2 épisodes antérieurs/);
  assert.doesNotMatch(t, /Relire les issues aujourd'hui/, 'libellé de bouton absent');
  assert.equal(section.open, false, 'la copie ne rouvre rien');
});

test('O6. ÉCHEC DU PRESSE-PAPIERS : jamais de faux « Copié ✓ » ; état inchangé ; sans presse-papiers disponible (défaut) → « Copie impossible »', async () => {
  const { capacite, appels } = pontCompte();
  const refus = await ecranAvec(capacite, async () => { throw new Error('permission refusée'); });
  const avant = photo(refus.zone); const appelsAvant = { ...appels };
  await cliquer(refus.boutonCopier);
  assert.equal(refus.boutonCopier.textContent, 'Copie impossible : permission refusée');
  assert.equal(refus.boutonCopier.disabled, false);
  assert.deepEqual(appels, appelsAvant);
  const lisse = (p) => JSON.parse(JSON.stringify(p), (k, v) => (v && v.cls === 'lien-action bouton-copier-diagnostic' ? { ...v, texte: '' } : v));
  assert.deepEqual(lisse(photo(refus.zone)), lisse(avant));
  // défaut : navigator.clipboard absent (aucun presse-papiers) → échec propre
  const sauve = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  try {
    const defaut = await ecranAvec(pontCompte().capacite);
    await cliquer(defaut.boutonCopier);
    assert.match(defaut.boutonCopier.textContent, /^Copie impossible/);
    assert.notEqual(defaut.boutonCopier.textContent, 'Copié ✓');
  } finally {
    if (sauve) Object.defineProperty(globalThis, 'navigator', sauve); else delete globalThis.navigator;
  }
  // réussite après échec : le libellé dit la vérité du dernier geste
  let ok = false;
  const second = await ecranAvec(pontCompte().capacite, async () => { if (!ok) { ok = true; throw new Error('x'); } });
  await cliquer(second.boutonCopier); assert.equal(second.boutonCopier.textContent, 'Copie impossible : x');
  await cliquer(second.boutonCopier); assert.equal(second.boutonCopier.textContent, 'Copié ✓');
});

// ================================================================================================================ O7 gardes statiques
test('O7. GARDES : le geste n\'appelle que la sérialisation et le presse-papiers (aucun pont, aucune table, aucune ouverture) ; la section paresseuse est marquée ; outillage non cognitif (aucun module du langage touché)', () => {
  const ui = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  const i = ui.indexOf("const boutonCopier = bouton_('Copier le diagnostic'");
  const j = ui.indexOf("boutonCopier.classList.add('bouton-copier-diagnostic');", i);
  assert.ok(i > 0 && j > i);
  const geste = ui.slice(i, j);
  assert.match(geste, /await copier\(texteDiagnostic\(zoneDiagnostic\)\);/);
  assert.doesNotMatch(geste, /capacite|charger|rafraichir|lireTout|magasin|\.open\s*=|toggle|dispatch|setTimeout|repondre|envoyer/);
  assert.equal((ui.match(/texteDiagnostic\(/g) || []).length, 1, 'un seul appel');
  assert.match(ui, /section\.className = `diagnostic-details attentes-conditionnees-zone \$\{CLASSE_PARESSEUSE\}`;/);
  assert.match(ui, /copier = \(t\) => navigator\.clipboard\.writeText\(t\),/);
  const main = lu('app', 'main.js');
  assert.doesNotMatch(main, /texte-diagnostic|texteDiagnostic/, 'main.js inchangé pour cet outil');
  for (const f of fichiersJs(join(RACINE, 'app', 'langage'))) assert.doesNotMatch(readFileSync(f, 'utf8'), /texte-diagnostic|texteDiagnostic|copier-diagnostic/, relative(RACINE, f));
});
