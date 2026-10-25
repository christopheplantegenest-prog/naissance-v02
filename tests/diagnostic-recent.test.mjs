// v0.64.32 — OUTIL-2 « DIAGNOSTIC RÉCENT EN TÊTE » (GO ChatGPT « DÉCISION VALIDATION v0.64.31 », 16/10/2026).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance, moteur RETROUVAILLE et données persistées inchangés. Deux corrections d'ergonomie :
// (1) « Copier le diagnostic » place EN TÊTE de la section « Relations retrouvées avant l'attente » les contextes de l'ACTE LE PLUS RÉCENT de la
//     représentation déjà construite, puis tout le reste ; l'écran garde son ordre ; aucune ligne supprimée ni ajoutée ;
// (2) tant que cette section se relit, le bouton est désactivé et dit « Diagnostic en cours de chargement » ; le clic ne lit jamais rien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { texteDiagnostic, CLASSE_RECENT_EN_TETE, CLASSE_ACTE_RECENT } from '../app/conversation/texte-diagnostic.js';
import { relireRetrouvailles, attentesEcritesParContexte } from '../app/langage/retrouvailles-persistees.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
function fichiersJs(d) { return readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : (p.endsWith('.js') ? [p] : []); }); }
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// ------------------------------------------------------------------------------------------------ DOM factice (même forme que copie-diagnostic)
class Faux {
  get parentNode() { return this.parent; }
  get textContent() { return this._texte; }
  set textContent(v) { this._texte = String(v); this.children = []; }
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.attrs = {}; this.open = false; this.type = ''; this.title = ''; }
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
  removeAttribute(k) { delete this.attrs[k]; }
  focus() {}
  scrollIntoView() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const el = (tag, texte = '', ...enfants) => { const e = new Faux(tag); e.textContent = texte; e.append(...enfants); return e; };
const trouver = (e, f) => (f(e) ? e : (e.children || []).map((c) => trouver(c, f)).find(Boolean) || null);
const photo = (e) => ({ tag: e.tag, cls: e.className, texte: e.textContent, open: e.open, disabled: e.disabled, hidden: e.hidden, attrs: { ...e.attrs }, enfants: e.children.map(photo) });
const ouvrir = (e, ouvert) => { e.open = ouvert; return Promise.all((e.listeners.toggle || []).map((f) => f())); };
const cliquer = (b) => Promise.all(b.listeners.click.map((f) => f()));
const tick = () => new Promise((r) => setTimeout(r, 0));

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
  return { zone, section: trouver(zone, (e) => e._cls.has('retrouvailles-zone')), boutonCopier: trouver(zone, (e) => e.tag === 'button' && e._cls.has('bouton-copier-diagnostic')) };
}

// ------------------------------------------------------------------------------------------------ données : la forme exacte du tour vécu au téléphone
// Un tour « ma ville ? » : actes d'observation (designation …13), émission (…75) écrits d'abord ; le TOUR ACTIF soi:tour est désigné par
// l'observation du DÉBUT du tour (…12, identité la plus ancienne) mais son contexte est écrit EN DERNIER. L'identité ne donne donc pas l'ordre.
const STRUCTURE = (operation) => [{ operation, entrees: ['etat'] }];
const AUCUNE = { statut: 'aucune', relations: [], nonComparees: [] };
const TOUR_2_1 = { statut: 'retrouvee', relations: [{ relation: { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: { valeurs: { arrivee: 1 } } }, formulations: ['attente-prospective-1791000000000-174-576', 'attente-prospective-1791100000000-457-684'] }], nonComparees: [] };
const ligne = (id, idDesignation, operation, horodatage, retrouvaille) => ({ id, idDesignation, horodatage, structure: STRUCTURE(operation), ...(retrouvaille ? { retrouvaille } : {}) });
const LIGNES = [
  ligne('contexte-prospectif-1792155380000-1-1', 'designation-application-1792155370000-0-1', 'soi:repos', '2026-10-16T12:55:32.889Z', AUCUNE),
  ligne('contexte-prospectif-1792155385000-14-739', 'designation-application-1792155384000-13-637', 'elementsObservables', '2026-10-16T12:56:25.460Z', AUCUNE),
  ligne('contexte-prospectif-1792155386000-15-384', 'designation-application-1792155384000-13-637', 'elementsObservables', '2026-10-16T12:56:25.993Z', AUCUNE),
  ligne('contexte-prospectif-1792155424000-76-445', 'emission-1792155423000-75-805', 'environnement:conversation', '2026-10-16T12:57:04.642Z', AUCUNE),
  ligne('contexte-prospectif-1792155425000-77-169', 'emission-1792155423000-75-805', 'environnement:conversation', '2026-10-16T12:57:05.024Z', AUCUNE),
  ligne('contexte-prospectif-1792155440000-164-10', 'observation-possibilites-1792155381947-12-252', 'soi:tour', '2026-10-16T12:57:20.100Z', TOUR_2_1),
  ligne('contexte-prospectif-1792000000000-3-3', 'designation-application-1792000000000-2-327', 'soi:tour', '2026-10-15T10:00:00.000Z'), // antérieur
];
const ATTENTES = [
  { id: 'attente-prospective-1792155441000-165-1', horodatage: '2026-10-16T12:57:20.300Z', references: { idContexte: 'contexte-prospectif-1792155440000-164-10' } },
  { id: 'attente-prospective-1792155426000-78-2', horodatage: '2026-10-16T12:57:05.500Z', references: { idContexte: 'contexte-prospectif-1792155424000-76-445' } },
];
const pontDe = (lignes, attentes = []) => async () => ({ relues: relireRetrouvailles(lignes), attentes: attentesEcritesParContexte(attentes) });
function capaciteDe(retrouvailles) {
  const appels = { retrouvailles: 0, lire: 0 };
  return { appels, capacite: { lire: async () => { appels.lire += 1; return { valeur: 1, plafond: 3, derniere: null, besoins: [] }; }, repos: async () => ({}), retrouvailles: async () => { appels.retrouvailles += 1; return retrouvailles(); } } };
}
const SECTION = 'Relations retrouvées avant l\'attente';
const lignesSection = (texte) => { const l = texte.split('\n'); const i = l.indexOf(SECTION); return l.slice(i + 1).filter((x) => x.startsWith('  ')).map((x) => x.trim()); };
const contextesDans = (lignes) => lignes.filter((x) => x.startsWith('contexte ')).map((x) => x.split(' · ')[0]);

// ================================================================================================================ R1 ordre de copie
test('R1. COPIE : les contextes de l\'acte le plus récent (contexte écrit EN DERNIER) d\'abord, puis le reste dans l\'ordre de la table ; l\'écran garde son ordre ; aucune ligne supprimée ni ajoutée ; zéro lecture au clic', async () => {
  const { capacite, appels } = capaciteDe(pontDe(LIGNES, ATTENTES));
  const copies = [];
  const { zone, section, boutonCopier } = await ecranAvec(capacite, async (t) => { copies.push(t); });
  await ouvrir(zone, true); await tick();
  assert.equal(appels.retrouvailles, 1);
  assert.equal(boutonCopier.disabled, false); assert.equal(boutonCopier.textContent, 'Copier le diagnostic');
  const avant = photo(zone); const appelsAvant = { ...appels };
  await cliquer(boutonCopier);
  assert.deepEqual(appels, appelsAvant, 'le clic ne lit rien');
  const sansBouton = (p) => JSON.parse(JSON.stringify(p), (k, v) => (v && typeof v.cls === 'string' && v.cls.includes('bouton-copier-diagnostic') ? { ...v, texte: '' } : v));
  assert.deepEqual(sansBouton(photo(zone)), sansBouton(avant), 'représentation identique avant / après la copie (hors libellé du bouton)');
  const t = copies[0];
  // en tête de la section : le contexte soi:tour du tour, son groupe 2→1, ses deux formulations en UNE relation, puis ses attentes (preuve d'ordre)
  const s = lignesSection(t);
  assert.equal(s[0], 'contexte contexte-prospectif…164-10 · acte observation-possibilites…12-252 · soi:tour · persisté le 2026-10-16 12:57:20.100, relu tel quel');
  // MISE À JOUR DÉLIBÉRÉE v0.64.33 : + la ligne « RELATION RETROUVÉE À T2 — PERSISTÉE » au-dessus du groupe d'un contexte retrouvee (rangs décalés de 1)
  assert.equal(s[1], 'RELATION RETROUVÉE À T2 — PERSISTÉE');
  assert.equal(s[2], 'relation retrouvée avant toute attente de cet acte');
  assert.equal(s[3], 'relation : domaine soi:tour(etat) · connu { valeurs: { depart: 2 } } · attendu { valeurs: { arrivee: 1 } }');
  assert.equal(s[4], 'formulations : attente-prospective…174-576, attente-prospective…457-684');
  assert.equal(s[5], 'attentes de ce contexte : attente-prospective…165-1 (2026-10-16 12:57:20.300)');
  // puis tous les autres contextes, dans l'ordre de la table, sans perte
  assert.deepEqual(contextesDans(s), ['contexte contexte-prospectif…164-10', 'contexte contexte-prospectif…1-1', 'contexte contexte-prospectif…14-739', 'contexte contexte-prospectif…15-384', 'contexte contexte-prospectif…76-445', 'contexte contexte-prospectif…77-169']);
  // l'écran garde l'ordre de la table
  const contenu = section.children[1];
  assert.ok(contenu._cls.has(CLASSE_RECENT_EN_TETE));
  assert.deepEqual(contenu.children.filter((b) => b._cls.has('acte-situe')).map((b) => b.children[0].textContent.split(' · ')[0]), ['contexte contexte-prospectif…1-1', 'contexte contexte-prospectif…14-739', 'contexte contexte-prospectif…15-384', 'contexte contexte-prospectif…76-445', 'contexte contexte-prospectif…77-169', 'contexte contexte-prospectif…164-10']);
  assert.deepEqual(contenu.children.filter((b) => b._cls.has(CLASSE_ACTE_RECENT)).length, 1);
  // aucune ligne ajoutée ni supprimée : même multiensemble que la copie sans marquage
  contenu._cls.delete(CLASSE_RECENT_EN_TETE);
  const sansOrdre = texteDiagnostic(zone);
  contenu._cls.add(CLASSE_RECENT_EN_TETE);
  assert.notEqual(sansOrdre, t, 'seul l\'ordre change');
  assert.deepEqual(t.split('\n').sort(), sansOrdre.split('\n').sort());
  // la section reste après ce qui la précède dans le panneau, et les contextes antérieurs restent à part
  assert.ok(t.indexOf(SECTION) > 0);
  assert.match(t, /Contextes antérieurs à v0\.64\.31 — retrouvaille non effectuée historiquement\n {4}\(section non ouverte\)/);
});

test('R2. ACTE LE PLUS RÉCENT : plusieurs contextes du même acte tous en tête (ordre de la table) ; identité seule jamais utilisée pour ordonner ; deux actes au même dernier instant, ou horodatage absent → AUCUN marquage, ordre de la table', async () => {
  // l'acte récent a deux contextes, non contigus dans la table
  const deux = [
    ligne('contexte-prospectif-1-1-1', 'acte-B', 'environnement:conversation', '2026-10-16T12:00:01.000Z', AUCUNE),
    ligne('contexte-prospectif-1-2-1', 'acte-A', 'soi:tour', '2026-10-16T12:00:02.000Z', TOUR_2_1),
    ligne('contexte-prospectif-1-3-1', 'acte-B', 'environnement:conversation', '2026-10-16T12:00:03.000Z', AUCUNE),
  ];
  let { capacite } = capaciteDe(pontDe(deux));
  let r = await ecranAvec(capacite, async () => {}); await ouvrir(r.zone, true); await tick();
  assert.deepEqual(contextesDans(lignesSection(texteDiagnostic(r.zone))), ['contexte contexte-prospectif-1-1-1', 'contexte contexte-prospectif-1-3-1', 'contexte contexte-prospectif-1-2-1']);
  // égalité au dernier instant entre deux actes différents : rien n'est deviné
  const egalite = [
    ligne('contexte-prospectif-2-1-1', 'acte-B', 'environnement:conversation', '2026-10-16T12:00:05.000Z', AUCUNE),
    ligne('contexte-prospectif-2-2-1', 'acte-A', 'soi:tour', '2026-10-16T12:00:05.000Z', TOUR_2_1),
  ];
  ({ capacite } = capaciteDe(pontDe(egalite)));
  r = await ecranAvec(capacite, async () => {}); await ouvrir(r.zone, true); await tick();
  assert.equal(r.section.children[1]._cls.has(CLASSE_RECENT_EN_TETE), false);
  assert.deepEqual(contextesDans(lignesSection(texteDiagnostic(r.zone))), ['contexte contexte-prospectif-2-1-1', 'contexte contexte-prospectif-2-2-1']);
  // horodatage absent sur une ligne : rien n'est deviné
  const sans = [ligne('contexte-prospectif-3-1-1', 'acte-B', 'x', '2026-10-16T12:00:09.000Z', AUCUNE), { ...ligne('contexte-prospectif-3-2-1', 'acte-A', 'soi:tour', null, TOUR_2_1), horodatage: undefined }];
  ({ capacite } = capaciteDe(pontDe(sans)));
  r = await ecranAvec(capacite, async () => {}); await ouvrir(r.zone, true); await tick();
  assert.equal(trouver(r.zone, (e) => e._cls.has(CLASSE_ACTE_RECENT)), null);
  // aucun contexte depuis v0.64.31 : la ligne habituelle, aucun marquage
  ({ capacite } = capaciteDe(pontDe([LIGNES[6]])));
  r = await ecranAvec(capacite, async () => {}); await ouvrir(r.zone, true); await tick();
  assert.ok(texteDiagnostic(r.zone).includes('aucun contexte écrit depuis v0.64.31'));
  assert.equal(trouver(r.zone, (e) => e._cls.has(CLASSE_RECENT_EN_TETE)), null);
});

test('R3. SÉRIALISATION : seul un conteneur marqué réordonne ses enfants marqués ; ailleurs, ordre du document ; arbre jamais modifié', () => {
  const a = el('div', '', el('div', 'a1')); const b = el('div', '', el('div', 'b1')); b.classList.add(CLASSE_ACTE_RECENT); const c = el('div', 'c');
  const marque = el('div', '', a, b, c); marque.classList.add(CLASSE_RECENT_EN_TETE);
  const avant = photo(marque);
  assert.equal(texteDiagnostic(el('details', '', el('summary', 'D'), marque)), ['D', 'b1', 'a1', 'c'].join('\n'));
  assert.deepEqual(photo(marque), avant);
  const b2 = el('div', '', el('div', 'b1')); b2.classList.add(CLASSE_ACTE_RECENT);
  assert.equal(texteDiagnostic(el('details', '', el('summary', 'D'), el('div', '', el('div', '', el('div', 'a1')), b2))), ['D', 'a1', 'b1'].join('\n'), 'sans conteneur marqué : ordre du document');
});

// ================================================================================================================ R4 chargement
test('R4. CHARGEMENT : bouton désactivé « Diagnostic en cours de chargement » tant que la section se relit ; réactivé quand la représentation est construite (ou en échec) ; relectures superposées : seule la dernière réactive ; le clic ne lit rien', async () => {
  const attentes = [];
  const lecture = () => new Promise((ok, ko) => attentes.push({ ok, ko }));
  const { capacite, appels } = capaciteDe(lecture);
  const copies = [];
  const { zone, boutonCopier } = await ecranAvec(capacite, async (t) => { copies.push(t); });
  assert.equal(boutonCopier.disabled, false, 'panneau fermé : état normal');
  const premiere = ouvrir(zone, true);
  assert.equal(appels.retrouvailles, 1);
  assert.equal(boutonCopier.disabled, true); assert.equal(boutonCopier.textContent, 'Diagnostic en cours de chargement');
  // relecture superposée (fermer / rouvrir pendant la lecture)
  zone.open = false; await Promise.all(zone.listeners.toggle.map((f) => f()));
  const seconde = ouvrir(zone, true);
  assert.equal(appels.retrouvailles, 2);
  attentes[0].ok(await pontDe(LIGNES, ATTENTES)()); await premiere;
  assert.equal(boutonCopier.disabled, true, 'la première relecture, dépassée, ne réactive pas');
  // un clic (impossible au vrai DOM, bouton désactivé) ne lit rien et ne réactive pas le bouton pendant la relecture
  await cliquer(boutonCopier);
  assert.equal(appels.retrouvailles, 2);
  assert.equal(boutonCopier.disabled, true); assert.equal(boutonCopier.textContent, 'Diagnostic en cours de chargement');
  attentes[1].ok(await pontDe(LIGNES, ATTENTES)()); await seconde;
  assert.equal(boutonCopier.disabled, false); assert.equal(boutonCopier.textContent, 'Copier le diagnostic');
  await cliquer(boutonCopier);
  assert.equal(boutonCopier.textContent, 'Copié ✓');
  assert.equal(lignesSection(copies.at(-1))[0].startsWith('contexte contexte-prospectif…164-10'), true, 'copie complète, acte récent en tête');
  assert.equal(appels.retrouvailles, 2, 'aucune lecture déclenchée par le clic');
  // échec de lecture : réactivé, la ligne d'erreur est copiée
  const echec = await ecranAvec(capaciteDe(async () => { throw new Error('magasin fermé'); }).capacite, async (t) => { copies.push(t); });
  await ouvrir(echec.zone, true); await tick();
  assert.equal(echec.boutonCopier.disabled, false); assert.equal(echec.boutonCopier.textContent, 'Copier le diagnostic');
  await cliquer(echec.boutonCopier);
  assert.ok(copies.at(-1).includes('retrouvailles non lisibles : magasin fermé'));
  // sans pont retrouvailles : bouton jamais désactivé
  const sans = await ecranAvec({ lire: async () => ({ valeur: 1, plafond: 3, derniere: null, besoins: [] }), repos: async () => ({}) }, async () => {});
  await ouvrir(sans.zone, true); await tick();
  assert.equal(sans.boutonCopier.disabled, false);
});

// ================================================================================================================ R5 gardes
test('R5. CONCURRENCE : une ANCIENNE relecture qui se termine APRÈS la plus récente ne réactive ni ne désactive le bouton, ne remplace ni le contenu ni le marquage ; même en échec', async () => {
  for (const issueAncienne of ['ok', 'ko']) {
    const attentes = [];
    const { capacite, appels } = capaciteDe(() => new Promise((ok, ko) => attentes.push({ ok, ko })));
    const copies = [];
    const { zone, section, boutonCopier } = await ecranAvec(capacite, async (t) => { copies.push(t); });
    const ancienne = ouvrir(zone, true);
    zone.open = false; await Promise.all(zone.listeners.toggle.map((f) => f()));
    const recente = ouvrir(zone, true);
    assert.equal(appels.retrouvailles, 2);
    // la plus récente se termine d'abord (données sans l'acte soi:tour) : bouton réactivé, son contenu affiché
    const lignesRecentes = LIGNES.slice(0, 5);
    attentes[1].ok(await pontDe(lignesRecentes)()); await recente;
    assert.equal(boutonCopier.disabled, false); assert.equal(boutonCopier.textContent, 'Copier le diagnostic');
    const etat = photo(zone);
    // puis l'ancienne se termine (autres données, ou échec)
    if (issueAncienne === 'ok') attentes[0].ok(await pontDe(LIGNES, ATTENTES)()); else attentes[0].ko(new Error('ancienne en échec'));
    await ancienne; await tick();
    assert.deepEqual(photo(zone), etat, `ancienne ${issueAncienne} : rien ne change (bouton, contenu, marquage)`);
    await cliquer(boutonCopier);
    const t = copies.at(-1);
    assert.equal(t.includes('soi:tour'), false, 'le contenu reste celui de la DERNIÈRE relecture');
    assert.equal(t.includes('ancienne en échec'), false);
    assert.deepEqual(contextesDans(lignesSection(t))[0], 'contexte contexte-prospectif…76-445', 'acte récent de la dernière relecture : l\'émission');
    assert.equal(section.children.filter((c) => c.tag === 'div').length, 1, 'un seul contenu');
  }
});

// ================================================================================================================ R6 gardes
// Source de la fonction nommée, exception étroite à la garde H12 (attentes-conditionnees-persistees.test.mjs).
const UI = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
const SOURCE_RECENT = (() => { const d = UI.indexOf('  function acteLePlusRecent(contextes) {'); return UI.slice(d, UI.indexOf('\n  }\n', d) + 4).trim(); })();
test('R6. GARDE v0.64.32 — acteLePlusRecent : (1) pure ; (2) aucune table lue ; (3) aucune identité découpée ; (4) rien ne retourne vers un module cognitif ; (5) seul consommateur : le marquage UI de l\'ordre de copie ; (6) aucun horodatage dans le moteur RETROUVAILLE', () => {
  // (1) PURE : la source isolée, évaluée HORS de l'écran (new Function : aucune fermeture accessible), fonctionne seule ; entrées gelées intactes ; même entrée → même sortie
  assert.doesNotMatch(SOURCE_RECENT, /\bawait\b|\bthis\b|document|window|globalThis|capacite|contenu|section|boutonCopier|retrouvaillesEnLecture|Date|Math\.|setTimeout|\.push\(|\.splice\(|\.sort\(|delete /);
  const acteLePlusRecent = new Function(`'use strict'; return (${SOURCE_RECENT.replace(/^function acteLePlusRecent/, 'function')});`)();
  const gele = (o) => { Object.values(o).forEach((v) => (v && typeof v === 'object' ? gele(v) : null)); return Object.freeze(o); };
  const entree = gele([{ idActe: 'emission-9-75-805', horodatage: '2026-10-16T12:57:05.024Z' }, { idActe: 'observation-possibilites-1-12-252', horodatage: '2026-10-16T12:57:20.100Z' }, { idActe: 'emission-9-75-805', horodatage: '2026-10-16T12:57:04.642Z' }]);
  assert.equal(acteLePlusRecent(entree), 'observation-possibilites-1-12-252', 'l\'identité la plus « ancienne » est bien l\'acte écrit en dernier');
  assert.equal(acteLePlusRecent(entree), acteLePlusRecent(entree));
  assert.equal(acteLePlusRecent([]), null);
  assert.equal(acteLePlusRecent([{ idActe: 'a', horodatage: 'x' }, { idActe: 'b', horodatage: 'x' }]), null, 'égalité : rien n\'est deviné');
  assert.equal(acteLePlusRecent([{ idActe: 'a', horodatage: 'x' }, { idActe: 'b', horodatage: null }]), null, 'absent : rien n\'est deviné');
  assert.equal(acteLePlusRecent([{ idActe: 'a', horodatage: 'x' }, { idActe: 'a', horodatage: 'x' }]), 'a', 'deux contextes du même acte au même instant : un seul acte');
  // (2) aucune table, aucun pont, aucun magasin
  assert.doesNotMatch(SOURCE_RECENT, /lireTout|magasin|capacite|retrouvailles\(|attentes|relues/);
  // (3) aucune identité découpée ni interprétée : idActe n'est que comparé à l'identique (Set), jamais transformé
  assert.doesNotMatch(SOURCE_RECENT, /split|match|slice|substr|replace|parse|indexOf|startsWith|endsWith|RegExp|\/[^/\n]+\/[gimsuy]*\./);
  assert.match(SOURCE_RECENT, /new Set\(contextes\.filter\(\(x\) => x\.horodatage === dernier\)\.map\(\(x\) => x\.idActe\)\)/);
  // (4)+(5) un seul appel ; son résultat ne sert qu'aux deux classes de marquage ; ecran.js n'exporte que monterConversation ; aucun module cognitif ne l'importe
  assert.equal((UI.match(/acteLePlusRecent\(/g) || []).length, 2, 'définition + un seul appel');
  const appel = UI.indexOf('const recent = acteLePlusRecent(avecGroupe);');
  assert.ok(appel > 0);
  const usages = [...UI.matchAll(/\brecent\b/g)].map((m) => m.index);
  const finConstruire = UI.indexOf('if (anterieurs.length)', appel);
  assert.ok(usages.every((k) => k >= appel && k < finConstruire), 'recent ne sort pas de la construction des blocs');
  const portee = UI.slice(appel, finConstruire);
  assert.deepEqual(portee.split('\n').filter((l) => /\brecent\b/.test(l)).map((l) => l.trim()), [
    'const recent = acteLePlusRecent(avecGroupe);',
    'if (recent !== null) neuf.className = CLASSE_RECENT_EN_TETE;',
    'bloc.className = recent !== null && x.idActe === recent ? `acte-situe ${CLASSE_ACTE_RECENT}` : \'acte-situe\';',
  ]);
  assert.deepEqual([...UI.matchAll(/^export .*$/gm)].map((m) => m[0].split('(')[0]), ['export function monterConversation']);
  for (const f of fichiersJs(join(RACINE, 'app', 'langage'))) assert.doesNotMatch(sansCommentaires(readFileSync(f, 'utf8')), /from '[^']*conversation\/ecran\.js'|import\([^)]*conversation\/ecran|acteLePlusRecent|acte-recent|recent-en-tete|CLASSE_ACTE_RECENT/, f);
  // (6) aucun horodatage dans le moteur RETROUVAILLE (calcul et forme)
  for (const m of ['retrouvailles.js', 'retrouvaille-forme.js']) assert.doesNotMatch(sansCommentaires(lu('app', 'langage', m)), /horodatage|Date/, m);
});

test('R7. GARDES : outillage non cognitif — aucun module du langage, de main.js, ni du moteur RETROUVAILLE touché ; geste de copie sans lecture ; pas d\'attente temporelle ; base 29 / schéma 19 / 35 tables', () => {
  const ui = UI;
  const i = ui.indexOf("const boutonCopier = bouton_('Copier le diagnostic'");
  const j = ui.indexOf("boutonCopier.classList.add('bouton-copier-diagnostic');", i);
  const geste = ui.slice(i, j);
  assert.doesNotMatch(geste, /capacite|charger\(|construire\(|lireTout|magasin|\.open\s*=|setTimeout|setInterval/);
  assert.doesNotMatch(ui, /setTimeout\([^)]*chargement|new Promise\(\(r\) => setTimeout/);
  const serial = sansCommentaires(lu('app', 'conversation', 'texte-diagnostic.js'));
  assert.doesNotMatch(serial, /horodatage|Date|\.sort\(|idActe/);
  for (const f of ['retrouvailles.js', 'retrouvaille-forme.js', 'retrouvailles-persistees.js', 'connaissances.js']) assert.doesNotMatch(lu('app', 'langage', f), /v0\.64\.32|OUTIL-2/, f);
  assert.doesNotMatch(lu('app', 'main.js'), /v0\.64\.32|OUTIL-2|CLASSE_ACTE_RECENT/);
  assert.equal(VERSION_BASE, 30); assert.equal(SCHEMA_SAUVEGARDE, 20); assert.equal(TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
});
