// v0.65.3 — AT-4 « ÉCRAN ATELIER OFF / MANUEL » (GO « AUTORISATION AT-4 », 17/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune
// acquisition. Preuves sur un DOM factice et un stockage en mémoire : OFF par défaut et sans effet, MANUEL limité aux seules actions AT-1
// autorisées (ouverture, approbation, arrêt), SHA de base saisi et jamais deviné, dossier copié = texte généré = construireMission des
// données composées (AT-1 + fiche locale, sans le mode), vérification de forme sans aucune écriture, budget affiché depuis etatBudget seul,
// journaux séparés, copie locale relue par les vérificateurs (illisible => rien n'est utilisé ni réparé), effacement ; branchement unique
// et paresseux depuis main.js, aucun réseau, une seule clé, sw.js inchangé, base / schéma / tables inchangés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/ecran.js';
import { monterAtelier, CLE_ATELIER } from '../app/atelier/ecran.js';
import { construireMission, verifierRapport } from '../app/atelier/mission.js';
import { ouvrirChantier, appliquer, verifierJournal } from '../app/atelier/chantier.js';
import { ouvrirRegistre, appliquerBudget, etatBudget, verifierRegistre } from '../app/atelier/budget.js';
import { ecrireUSD } from '../app/atelier/montants.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { confirmerSauvegarde } from './atelier-aide.mjs'; // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3 : sauvegarde confirmée avant copie du dossier)

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ATELIER = join(RACINE, 'app', 'atelier');
const SRC = readFileSync(join(ATELIER, 'ecran.js'), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CODE = sansCommentaires(SRC);
const SHA = 'b386d9e0123456789abcdef0123456789abcdef0';
const VERSION = '0.65.3';
const octets = (t) => Buffer.byteLength(t, 'utf8');

// ------------------------------------------------------------------------------------------------ DOM factice et stockage
class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this.className = ''; this._texte = ''; this.value = ''; this.disabled = false; this.open = false; this.attrs = {}; this.rows = 0; this.type = ''; this.readOnly = false; }
  get textContent() { return this._texte; }
  set textContent(v) { this._texte = String(v); for (const c of this.children) c.parent = null; this.children = []; }
  append(...cs) { for (const c of cs) { c.parent = this; this.children.push(c); } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
}
const tous = (e, f) => [...(f(e) ? [e] : []), ...e.children.flatMap((c) => tous(c, f))];
const textes = (e) => [e._texte, ...e.children.flatMap(textes)].filter(Boolean);
function stockageMemoire(initial = null) {
  const m = new Map(initial === null ? [] : [[CLE_ATELIER, initial]]);
  const s = { ecritures: 0, effacements: 0, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { s.ecritures += 1; m.set(k, String(v)); }, removeItem: (k) => { s.effacements += 1; m.delete(k); }, cles: () => [...m.keys()] };
  return s;
}
function monter({ stockage = stockageMemoire(), copier = async () => {}, version = VERSION } = {}) {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  const zone = new Faux('div');
  let t = 0;
  const copies = [];
  const ecran = monterAtelier({ zone, version, stockage, copier: (x) => { copies.push(x); return copier(x); }, maintenant: () => `2026-10-17T10:00:${String(t++).padStart(2, '0')}.000Z` });
  const trouver = (nom) => tous(zone, (e) => e.attrs['data-atelier'] === nom);
  const un = (nom) => { const l = trouver(nom); assert.equal(l.length, 1, `élément « ${nom} » attendu une fois (${l.length})`); return l[0]; };
  const cliquer = async (nom) => { const b = un(nom); for (const f of b.listeners.click) await f(); };
  const saisir = (nom, valeur) => { const e = un(nom); e.value = valeur; for (const f of e.listeners.input || []) f(); };
  const copie = () => JSON.parse(stockage.getItem(CLE_ATELIER));
  const texte = () => textes(zone).join('\n');
  return { zone, stockage, ecran, trouver, un, cliquer, saisir, copie, texte, copies };
}
// Chantier témoin ouvert puis plan approuvé (en cours), en MANUEL.
async function enCours(o = {}) {
  const a = monter(o);
  await a.cliquer('mode-manuel');
  await a.cliquer('temoin');
  a.saisir('sha', SHA);
  await a.cliquer('ouvrir');
  await a.cliquer('approuver');
  return a;
}
// Données attendues, composées EXPLICITEMENT à partir du témoin (AT-1 + fiche), sans aucun mode.
const ATTENDU = () => ({
  chantier: 'temoin-atelier', objectif: 'TÉMOIN — démontrer l\'écran Atelier OFF / MANUEL, sans aucun développement réel.', base: { sha: SHA, version: VERSION },
  jalon: { id: 'temoin-1', titre: 'Jalon témoin', comportement: 'TÉMOIN — le dossier de mission est généré et copié, puis un rapport témoin collé est vérifié dans sa forme seulement.' },
  tentative: 1, criteres: ['Le dossier copié est identique au dossier généré.', 'Le rapport témoin est déclaré conforme mais non vérifié.'],
  tests: ['Aucun test réel : chantier témoin.'], autorises: ['tests/temoin-atelier.test.mjs'], interdits: [], frontieres: ['Aucun développement réel.', 'Aucun dépôt.'],
  decisions: [{ id: 'D-007', texte: 'Atelier de développement : OUTILLAGE NON COGNITIF. Claude produit des candidats, jamais des acquisitions.' }],
});
const RAPPORT = (patch = {}) => JSON.stringify({
  protocole: 'atelier-rapport-1', chantier: 'temoin-atelier', jalon: 'temoin-1', tentative: 1, base: { sha: SHA, version: VERSION },
  statut: 'candidat', candidat: { branche: 'atelier/temoin-atelier/temoin-1/1', sha: 'c'.repeat(40) },
  fichiers: { crees: ['tests/temoin-atelier.test.mjs'], modifies: [], supprimes: [] }, tests: { total: 3, reussis: 3, echecs: 0 },
  divergences: [], question: null, motif: null, ...patch,
});

// ------------------------------------------------------------------------------------------------ OFF
test('premier lancement : mode OFF, rien n\'est écrit sur l\'appareil, bandeau OUTILLAGE NON COGNITIF', () => {
  const a = monter();
  assert.equal(a.un('mode').textContent, 'Mode : OFF');
  assert.equal(a.un('mode-off').attrs['aria-pressed'], 'true');
  assert.equal(a.stockage.ecritures, 0);
  const t = a.texte();
  for (const l of ['ATELIER DE DÉVELOPPEMENT', 'OUTILLAGE NON COGNITIF', 'Rien ici n\'est une acquisition de Naissance.']) assert.ok(t.includes(l), l);
});
test('neuf sections dans l\'ordre exigé, puis l\'effacement', () => { // MISE À JOUR DÉLIBÉRÉE v0.65.6 (AT-6 : + Vérification technique et Décision humaine, avant le journal)
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7) : + « 10. Sauvegarde durable et reprise », après le journal et avant l'effacement.
  // MISE À JOUR DÉLIBÉRÉE v0.65.18 (AT-10.1) : + « 12. Carnet de trois missions », après la sauvegarde (et après la section 11 en AUTO).
  const a = monter();
  const s = tous(a.zone, (e) => e.tag === 'details').map((d) => d.attrs['data-atelier-section']);
  assert.deepEqual(s, ['chantier', 'plan', 'fiche', 'budget', 'dossier', 'rapport', 'verification', 'decision', 'journaux', 'sauvegarde', 'carnet']);
  const titres = tous(a.zone, (e) => e.tag === 'summary').map((e) => e.textContent);
  assert.deepEqual(titres.map((x) => x.split(' ')[0]), ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '12.']);
  assert.ok(titres[10].includes('Carnet de trois missions'));
  assert.ok(titres[0].includes('Chantier') && titres[1].includes('Plan') && titres[2].includes('Fiche') && titres[3].includes('Budget') && titres[4].includes('Dossier') && titres[5].includes('Rapport') && titres[6].includes('Vérification technique') && titres[7].includes('Décision humaine') && titres[8].includes('Journal') && titres[9].includes('Sauvegarde durable'));
  assert.equal(a.trouver('effacer').length, 1);
});
test('OFF : consultation seulement — ni génération, ni copie, ni vérification ; champs et actions techniques désactivés', () => {
  const a = monter();
  for (const n of ['generer', 'copier', 'verifier', 'dossier', 'rapport']) assert.equal(a.trouver(n).length, 0, n);
  assert.equal(a.trouver('off-dossier').length, 1);
  assert.equal(a.trouver('off-rapport').length, 1);
  for (const n of ['temoin', 'ouvrir', 'ajouter-jalon', 'ouvrir-cycle']) assert.equal(a.un(n).disabled, true, n);
  for (const e of tous(a.zone, (x) => x.tag === 'input' || x.tag === 'textarea')) assert.equal(e.disabled, true, e.attrs['data-atelier']);
});
test('OFF : un contrôle désactivé déclenché quand même ne produit aucune transition ni écriture', async () => {
  const a = await enCours();
  const avant = a.stockage.getItem(CLE_ATELIER);
  await a.cliquer('mode-off');
  const ecritures = a.stockage.ecritures;
  const apresOff = a.copie();
  assert.equal(apresOff.mode, 'OFF');
  assert.deepEqual(apresOff.journal, JSON.parse(avant).journal);
  for (const nom of ['arreter']) { const b = a.un(nom); assert.equal(b.disabled, true); for (const f of b.listeners.click) await f(); }
  // Même réactivé de force (outil de développement du navigateur), un contrôle OFF ne déclenche rien : seconde garde dans l'action.
  a.saisir('motif-arret', 'forcé');
  for (const nom of ['arreter', 'ajouter-decision']) { const b = a.un(nom); b.disabled = false; for (const f of b.listeners.click) await f(); }
  a.saisir('motif-arret', 'forcé');
  a.saisir('comportement', 'modifié en OFF');
  assert.equal(a.stockage.ecritures, ecritures);
  assert.deepEqual(a.copie(), apresOff);
  assert.equal(a.copies.length, 0);
});

// ------------------------------------------------------------------------------------------------ MANUEL : chantier
test('MANUEL : le témoin préremplit le formulaire ; « CHANTIER TÉMOIN » est affiché ; aucun SHA n\'est inventé', async () => {
  const a = monter();
  await a.cliquer('mode-manuel');
  await a.cliquer('temoin');
  assert.equal(a.un('chantier-id').value, 'temoin-atelier');
  assert.equal(a.un('sha').value, '');
  assert.equal(a.un('version').value, VERSION);
  const t = a.un('temoin-bandeau');
  assert.equal(t.tag, 'div');
  assert.ok(textes(t).includes('CHANTIER TÉMOIN') && textes(t).includes('Démonstration — aucun développement réel.'));
  assert.equal(a.copie().journal, null);
});
test('« Version de base » et « SHA de base » sont deux champs distincts ; la version est préremplie depuis main.js', () => {
  const a = monter({ version: '1.2.3' });
  const libelles = tous(a.zone, (e) => e.tag === 'label').map((l) => l.children[0].textContent);
  assert.ok(libelles.includes('Version de base') && libelles.includes('SHA de base'));
  assert.equal(a.un('version').value, '1.2.3');
  assert.equal(a.un('sha').value, '');
});
test('SHA de base absent ou mal formé : ouverture refusée, aucun journal', async () => {
  const a = monter();
  await a.cliquer('mode-manuel');
  await a.cliquer('temoin');
  for (const s of ['', 'abc', SHA.toUpperCase(), `${SHA}0`]) {
    a.saisir('sha', s);
    await a.cliquer('ouvrir');
    assert.match(a.un('message').textContent, /SHA de base/);
    assert.equal(a.copie().journal, null);
  }
});
test('ouverture puis approbation : le journal AT-1 ne contient que « ouvert » et « plan-approuve », avec le SHA collé', async () => {
  const a = await enCours();
  const j = a.copie().journal;
  assert.deepEqual(j.map((e) => e.type), ['ouvert', 'plan-approuve']);
  assert.deepEqual(j[0].donnees.base, { sha: SHA, version: VERSION });
  assert.equal(j[0].donnees.plan[0].critere, 'Le dossier témoin est généré puis copié sans aucune modification.');
  assert.equal(verifierJournal(j).ok, true);
  assert.equal(a.un('statut').textContent, 'Statut technique : en-cours');
  assert.equal(a.trouver('approuver').length, 0);
});
test('arrêt : motif exigé par AT-1 ; avec motif, « chantier-arrete » est la seule transition ajoutée', async () => {
  const a = await enCours();
  await a.cliquer('arreter');
  assert.match(a.un('message').textContent, /^Refusé :/);
  assert.equal(a.copie().journal.length, 2);
  a.saisir('motif-arret', 'Démonstration terminée.');
  await a.cliquer('arreter');
  assert.deepEqual(a.copie().journal.map((e) => e.type), ['ouvert', 'plan-approuve', 'chantier-arrete']);
  assert.equal(a.un('statut').textContent, 'Statut technique : arrete');
  assert.equal(a.trouver('arreter').length, 0);
});
test('transitions AT-1 de l\'écran : AT-4 (ouverture, approbation, arrêt) + AT-6 (les cinq de tentative, par des gestes nommés)', () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.6 (AT-6 « MANUEL de bout en bout ») : les tentatives deviennent atteignables, mais SEULEMENT par les gestes
  // nommés du parcours (lancer, enregistrer, decider, annuler), chacun par avecEvenement ; aucune autre transition, appliquer() reste unique
  // par chemin (AT-4 : appliquerChantier ; AT-6 : avecEvenement).
  const appels = [...CODE.matchAll(/avecEvenement\((?:type|'([a-z-]+)')/g)].map((m) => m[1] || 'type').sort();
  // MISE À JOUR DÉLIBÉRÉE v0.65.9 (AT-8.1) : + le lancement AUTO (tentative-lancee) et la clôture AUTO (tentative-annulee), gestes nommés lancerAuto / cloreAuto.
  // MISE À JOUR DÉLIBÉRÉE v0.65.10 (AT-8.2) : + la clôture d'un témoin (tentative-annulee), geste nommé cloreTemoin.
  // MISE À JOUR DÉLIBÉRÉE v0.65.16 (AT-10.5) : ce test accepte ecran.js v0.65.15 ou v0.65.16 (dépôt des P1 avant le colis, sans test rouge) ;
  // la forme exacte v0.65.16 (+ tentative-rendue de enregistrerAuto) est exigée par tests/atelier-auto-decision.test.mjs.
  const sans = ['tentative-annulee', 'tentative-annulee', 'tentative-annulee', 'tentative-lancee', 'tentative-lancee', 'tentative-rendue', 'type', 'type']; // « type » : la définition, puis l'appel de decider
  const avec = ['tentative-annulee', 'tentative-annulee', 'tentative-annulee', 'tentative-lancee', 'tentative-lancee', 'tentative-rendue', 'tentative-rendue', 'type', 'type'];
  // MISE À JOUR DÉLIBÉRÉE v0.65.23 (R1, conception B) : + la régularisation sur preuve finale (tentative-annulee), geste nommé regulariserPreuve.
  const regul = ['tentative-annulee', 'tentative-annulee', 'tentative-annulee', 'tentative-annulee', 'tentative-lancee', 'tentative-lancee', 'tentative-rendue', 'tentative-rendue', 'type', 'type'];
  assert.ok([sans, avec, regul].some((x) => JSON.stringify(x) === JSON.stringify(appels)), JSON.stringify(appels));
  assert.deepEqual([...CODE.matchAll(/decider\('([a-z-]+)'\)/g)].map((m) => m[1]).sort(), ['tentative-acceptee', 'tentative-rejetee']);
  const types = [...CODE.matchAll(/appliquerChantier\('([a-z-]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(types, ['chantier-arrete', 'plan-approuve']);
  // MISE À JOUR DÉLIBÉRÉE v0.65.19 (AT-10.2) : un troisième chemin, NOMMÉ et unique : preparerMission ouvre le chantier de la mission
  // et pose « plan-approuve » (DB : la V1 du carnet couvre exactement ce plan), dans une copie vérifiée entière ; aucune tentative.
  assert.equal((CODE.match(/\bappliquer\(/g) || []).length, 3);
  assert.equal((CODE.match(/\bouvrirChantier\(/g) || []).length, 2);
  const prep = CODE.slice(CODE.indexOf('const preparerMission = (k) =>'), CODE.indexOf('const retablirPreparation = (k) =>'));
  assert.deepEqual([...prep.matchAll(/appliquer\(ouvrirChantier\(structuredClone\(p\.chantier\), quand\), \{ type: '([a-z-]+)'/g)].map((m) => m[1]), ['plan-approuve']);
  assert.equal((prep.match(/\bappliquer\(/g) || []).length, 1);
});

// ------------------------------------------------------------------------------------------------ dossier
test('dossier : texte affiché === texte copié === construireMission(données composées AT-1 + fiche), sans transformation', async () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3) : la copie ne se fait plus avant le lancement (« Copier » supprimé) mais après le lancement
  // et sa sauvegarde durable confirmée (« Copier le dossier de la tentative 1 ») ; l'égalité exacte affiché === copié est inchangée.
  const a = await enCours();
  await a.cliquer('generer');
  const attendu = construireMission(ATTENDU());
  assert.equal(a.un('dossier').value, attendu);
  assert.equal(a.un('dossier').readOnly, true);
  assert.equal(a.trouver('copier').length, 0);
  await a.cliquer('lancer');
  assert.deepEqual(a.copies, []);
  assert.equal(a.trouver('dossier').length, 0);
  await confirmerSauvegarde(a);
  assert.equal(a.un('dossier').value, attendu);
  await a.cliquer('recopier-dossier');
  assert.deepEqual(a.copies, [attendu]);
  assert.equal(a.copies[0], a.un('dossier').value);
  assert.equal(a.un('retour-dossier').textContent, `Dossier copié ✓ (${octets(attendu)} octets)`);
});
test('dossier : le mode n\'entre jamais dans les données ni dans les journaux', async () => {
  const a = monter();
  await a.cliquer('mode-manuel');
  a.saisir('chantier-id', 'demo-reel'); a.saisir('objectif', 'Objectif sans mot réservé.'); a.saisir('sha', SHA);
  a.saisir('jalon-0-id', 'j1'); a.saisir('jalon-0-titre', 'Titre'); a.saisir('jalon-0-critere', 'Critère.');
  await a.cliquer('ouvrir'); await a.cliquer('approuver');
  a.saisir('comportement', 'Comportement.'); a.saisir('criteres', 'Un critère.'); a.saisir('tests', 'Un test.'); a.saisir('autorises', 'app/x.js');
  await a.cliquer('generer');
  const d = a.un('dossier').value;
  assert.equal(d, construireMission({ chantier: 'demo-reel', objectif: 'Objectif sans mot réservé.', base: { sha: SHA, version: VERSION }, jalon: { id: 'j1', titre: 'Titre', comportement: 'Comportement.' }, tentative: 1, criteres: ['Un critère.'], tests: ['Un test.'], autorises: ['app/x.js'], interdits: [], frontieres: [], decisions: [] }));
  assert.doesNotMatch(d, /MANUEL|\bOFF\b|\bmode\b/i);
  assert.doesNotMatch(JSON.stringify([a.copie().journal, a.copie().registre]), /MANUEL|\bOFF\b|"mode"/);
});
test('dossier : copie impossible => message prévu, le texte reste affiché et sélectionnable', async () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3) : la copie du dossier n'existe qu'après le lancement et sa sauvegarde confirmée.
  const a = await enCours({ copier: async () => { throw new Error('refusée'); } });
  await a.cliquer('generer');
  const v = a.un('dossier').value;
  await a.cliquer('lancer');
  await confirmerSauvegarde(a);
  await a.cliquer('recopier-dossier');
  assert.equal(a.un('retour-dossier').textContent, 'Copie impossible : refusée — utilise « Recopier ».');
  assert.equal(a.un('dossier').value, v);
});
test('dossier : une ligne vide dans la fiche est refusée, jamais ignorée', async () => {
  const a = await enCours();
  a.saisir('criteres', 'a\n\nb');
  await a.cliquer('generer');
  assert.equal(a.un('message').textContent, 'Dossier impossible : Critères : ligne 2 vide');
  assert.equal(a.trouver('dossier').length, 0);
});
test('dossier : impossible avant l\'approbation du plan (fiche absente)', async () => {
  const a = monter();
  await a.cliquer('mode-manuel');
  await a.cliquer('temoin');
  a.saisir('sha', SHA);
  await a.cliquer('ouvrir');
  await a.cliquer('generer');
  assert.match(a.un('message').textContent, /^Dossier impossible : le chantier doit être en cours/);
});

// ------------------------------------------------------------------------------------------------ rapport
test('rapport candidat : phrases exactes, détails « Annoncé par Claude (non vérifié) »', async () => {
  const a = await enCours();
  await a.cliquer('generer'); // MISE À JOUR DÉLIBÉRÉE v0.65.3 (correction avant dépôt) : la vérification exige l'instantané du dernier dossier généré
  a.saisir('rapport', RAPPORT());
  await a.cliquer('verifier');
  const t = textes(a.un('verification'));
  assert.deepEqual(t.slice(0, 4), ['Rapport structurellement conforme.', 'Candidat NON VÉRIFIÉ.', 'Aucune validation ni acquisition.', 'Annoncé par Claude (non vérifié)']);
  assert.ok(t.includes('Branche : atelier/temoin-atelier/temoin-1/1'));
});
test('vérifier n\'écrit RIEN : ni journal AT-1, ni registre AT-2, ni copie locale ; aucun événement AT-1 ne suit un rapport conforme', async () => {
  const a = await enCours();
  await a.cliquer('ouvrir-cycle');
  await a.cliquer('generer'); // MISE À JOUR DÉLIBÉRÉE v0.65.3 (correction avant dépôt) : la vérification exige l'instantané du dernier dossier généré
  assert.notEqual(a.copie().mission, null);
  const avant = a.stockage.getItem(CLE_ATELIER);
  const ecritures = a.stockage.ecritures;
  for (const r of [RAPPORT(), RAPPORT({ statut: 'bloque', candidat: null, fichiers: { crees: [], modifies: [], supprimes: [] }, tests: null, question: 'Lequel ?' }), '{']) {
    a.saisir('rapport', r);
    await a.cliquer('verifier');
  }
  assert.equal(a.stockage.ecritures, ecritures);
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant);
  assert.deepEqual(a.copie().journal.map((e) => e.type), ['ouvert', 'plan-approuve']);
});
test('rapport bloque / echec : la question ou le motif annoncés sont affichés', async () => {
  const a = await enCours();
  await a.cliquer('generer'); // MISE À JOUR DÉLIBÉRÉE v0.65.3 (correction avant dépôt) : la vérification exige l'instantané du dernier dossier généré
  a.saisir('rapport', RAPPORT({ statut: 'bloque', candidat: null, fichiers: { crees: [], modifies: [], supprimes: [] }, tests: null, question: 'Quel fichier ?' }));
  await a.cliquer('verifier');
  assert.ok(textes(a.un('verification')).includes('Question de Claude : Quel fichier ?'));
  a.saisir('rapport', RAPPORT({ statut: 'echec', candidat: null, tests: { total: 3, reussis: 2, echecs: 1 }, motif: 'Un test échoue.' }));
  await a.cliquer('verifier');
  assert.ok(textes(a.un('verification')).includes('Motif annoncé : Un test échoue.'));
});
test('rapport non conforme : « Rapport NON CONFORME : <raison>. » puis « Rien n\'est enregistré. »', async () => {
  const a = await enCours();
  await a.cliquer('generer'); // MISE À JOUR DÉLIBÉRÉE v0.65.3 (correction avant dépôt) : la vérification exige l'instantané du dernier dossier généré
  const r = RAPPORT({ tentative: 2 });
  a.saisir('rapport', r);
  await a.cliquer('verifier');
  const attendu = verifierRapport(ATTENDU(), r);
  assert.equal(attendu.structure, 'non-conforme');
  assert.deepEqual(textes(a.un('verification')), [`Rapport NON CONFORME : ${attendu.raison}.`, 'Rien n\'est enregistré.']);
});

// ------------------------------------------------------------------------------------------------ instantané du dossier (correction avant dépôt v0.65.3)
// La fiche A est le témoin ; B ne diffère que par les chemins autorisés : le rapport A (qui crée tests/temoin-atelier.test.mjs) sort du périmètre B.
const DONNEES_B = () => ({ ...ATTENDU(), autorises: ['app/autre.js'] });
test('instantané : Générer fige les données exactes du dossier A ; une fiche modifiée ensuite (B) ne change ni l\'instantané ni la vérification', async () => {
  const a = await enCours();
  await a.cliquer('generer');
  const dossierA = a.un('dossier').value;
  assert.deepEqual(a.copie().mission, ATTENDU());
  assert.equal(construireMission(a.copie().mission), dossierA);
  a.saisir('autorises', 'app/autre.js');
  assert.deepEqual(a.copie().fiches['temoin-1'].autorises, 'app/autre.js');
  assert.deepEqual(a.copie().mission, ATTENDU());
  const r = RAPPORT();
  assert.equal(verifierRapport(ATTENDU(), r).structure, 'conforme');
  const contreB = verifierRapport(DONNEES_B(), r);
  assert.equal(contreB.structure, 'non-conforme');
  a.saisir('rapport', r);
  await a.cliquer('verifier');
  assert.equal(textes(a.un('verification'))[0], 'Rapport structurellement conforme.');
  assert.equal(a.un('dossier').value, dossierA);
  assert.match(a.un('reference').textContent, /^Référence : dernier dossier généré \(jalon temoin-1, tentative 1\)/);
});
test('instantané : un nouveau Générer explicite le remplace par B ; le rapport A est alors refusé contre B', async () => {
  const a = await enCours();
  await a.cliquer('generer');
  a.saisir('autorises', 'app/autre.js');
  await a.cliquer('generer');
  assert.deepEqual(a.copie().mission, DONNEES_B());
  assert.equal(a.un('dossier').value, construireMission(DONNEES_B()));
  const r = RAPPORT();
  a.saisir('rapport', r);
  await a.cliquer('verifier');
  assert.deepEqual(textes(a.un('verification')), [`Rapport NON CONFORME : ${verifierRapport(DONNEES_B(), r).raison}.`, 'Rien n\'est enregistré.']);
});
test('instantané : un Générer refusé garde l\'instantané précédent ; sans aucun Générer, la vérification est impossible', async () => {
  const a = await enCours();
  a.saisir('rapport', RAPPORT());
  await a.cliquer('verifier');
  assert.deepEqual(textes(a.un('verification')), ['Vérification impossible : aucun dossier généré.']);
  assert.equal(a.copie().mission, null);
  await a.cliquer('generer');
  a.saisir('criteres', 'a\n\nb');
  await a.cliquer('generer');
  assert.match(a.un('message').textContent, /^Dossier impossible/);
  assert.deepEqual(a.copie().mission, ATTENDU());
  await a.cliquer('verifier');
  assert.equal(textes(a.un('verification'))[0], 'Rapport structurellement conforme.');
  a.saisir('criteres', 'Un seul critère.');
  a.saisir('autorises', 'app/autre.js');
  assert.deepEqual(a.copie().mission, ATTENDU());
});
test('instantané : survit au démontage / remontage ; la vérification après remontage utilise A, pas la fiche B', async () => {
  const a = await enCours();
  await a.cliquer('generer');
  a.saisir('autorises', 'app/autre.js');
  const b = monter({ stockage: a.stockage });
  assert.deepEqual(b.copie().mission, ATTENDU());
  const ecritures = b.stockage.ecritures;
  b.saisir('rapport', RAPPORT());
  await b.cliquer('verifier');
  assert.equal(textes(b.un('verification'))[0], 'Rapport structurellement conforme.');
  assert.equal(b.stockage.ecritures, ecritures);
});
test('instantané corrompu : copie déclarée illisible, rien n\'est réparé ni réécrit', async () => {
  const a = await enCours();
  await a.cliquer('generer');
  const bonne = a.copie();
  const sans = { ...bonne }; delete sans.mission;
  const casses = [
    JSON.stringify(sans),
    JSON.stringify({ ...bonne, mission: 'A' }),
    JSON.stringify({ ...bonne, mission: { ...bonne.mission, tentative: 0 } }),
    JSON.stringify({ ...bonne, mission: { ...bonne.mission, inconnu: 1 } }),
    JSON.stringify({ ...bonne, mission: { ...bonne.mission, chantier: 'autre-chantier' } }),
    JSON.stringify({ ...bonne, mission: { ...bonne.mission, base: { sha: 'd'.repeat(40), version: VERSION } } }),
    JSON.stringify({ ...bonne, journal: null, mission: bonne.mission }),
  ];
  for (const brut of casses) {
    const s = stockageMemoire(brut);
    const b = monter({ stockage: s });
    assert.match(b.un('illisible').textContent, brut === casses[0] ? /\(version de copie inconnue\)/ : /^Copie locale illisible : rien n'est utilisé \(instantané du dossier/, brut.slice(-80));
    assert.equal(b.trouver('verifier').length, 0);
    assert.equal(s.ecritures, 0);
    assert.equal(s.getItem(CLE_ATELIER), brut);
  }
});
test('instantané : OFF reste sans effet ; aucune nouvelle transition AT-1 / AT-2 ; aucun mode dans l\'instantané', async () => {
  const a = await enCours();
  await a.cliquer('ouvrir-cycle');
  await a.cliquer('generer');
  const apres = a.copie();
  assert.deepEqual(apres.journal.map((e) => e.type), ['ouvert', 'plan-approuve']);
  assert.deepEqual(apres.registre.map((e) => e.type), ['cycle-ouvert']);
  assert.deepEqual(Object.keys(apres.mission).sort(), ['autorises', 'base', 'chantier', 'criteres', 'decisions', 'frontieres', 'interdits', 'jalon', 'objectif', 'tentative', 'tests']);
  assert.doesNotMatch(JSON.stringify(apres.mission), /"mode"/);
  await a.cliquer('mode-off');
  const ecritures = a.stockage.ecritures;
  assert.equal(a.trouver('generer').length, 0);
  assert.equal(a.trouver('verifier').length, 0);
  a.saisir('autorises', 'app/autre.js');
  assert.equal(a.stockage.ecritures, ecritures);
  assert.deepEqual(a.copie().mission, apres.mission);
});

// ------------------------------------------------------------------------------------------------ budget et journaux
test('budget : cycle et plafond du chantier lus en USD exacts ; affichage = ecrireUSD(etatBudget) ; aucun engagement ni coût', async () => {
  const a = await enCours();
  assert.equal(a.un('sans-execution').textContent, 'Aucune exécution dans AT-4 : aucun engagement, aucun coût.');
  await a.cliquer('ouvrir-cycle');
  a.saisir('plafond-chantier', '30,5');
  await a.cliquer('plafonner');
  const reg = a.copie().registre;
  assert.deepEqual(reg.map((e) => e.type), ['cycle-ouvert', 'chantier-plafonne']);
  const e = etatBudget(reg);
  assert.equal(e.plafond, 100000000);
  for (const [nom, v] of [['plafond', e.plafond], ['reserve', e.reserve], ['utilisable', e.utilisable], ['resteCycle', e.resteCycle], ['plafondRun', e.plafondRun], ['chantier-plafond', e.chantiers['temoin-atelier'].plafond], ['chantier-reste', e.chantiers['temoin-atelier'].reste]]) {
    assert.ok(a.un(`budget-${nom}`).textContent.endsWith(`: ${ecrireUSD(v)} USD`), nom);
  }
  assert.equal(a.un('budget-chantier-plafond').textContent, 'Plafond du chantier : 30,50 USD');
  assert.equal(a.un('budget-suspendu').textContent, 'Registre non suspendu.');
  // MISE À JOUR DÉLIBÉRÉE v0.65.9 (AT-8.1) : un seul engagement (lancerAuto, execution = T) et un seul coût (cloreAuto, montant 0) ; aucun ailleurs.
  assert.equal((CODE.match(/'engagement'/g) || []).length, 1);
  // MISE À JOUR DÉLIBÉRÉE v0.65.10 (AT-8.2) : + deux coûts : clôture d'un témoin (cloreTemoin : 0 pour NON ÉMIS, coût calculé pour RÉPONSE
  // CONNUE, AUCUN pour ISSUE INCONNUE) et régularisation humaine d'une issue inconnue (regulariser : montant saisi > 0).
  // MISE À JOUR DÉLIBÉRÉE v0.65.16 (AT-10.5) : 3 (ecran.js v0.65.15) ou 4 (v0.65.16 : + enregistrerAuto, coût de J2) ; le quatrième et sa
  // forme exacte sont exigés par tests/atelier-auto-decision.test.mjs.
  // MISE À JOUR DÉLIBÉRÉE v0.65.23 (R1, conception B) : 5 (+ regulariserPreuve : coût 0 « preuve-finale ») ; forme exacte exigée par
  // tests/atelier-regularisation.test.mjs.
  assert.ok([3, 4, 5].includes((CODE.match(/'cout'/g) || []).length));
  assert.match(CODE, /type: 'cout', quand: maintenant\(\), donnees: \{ execution: id\.t, montant: 0 \}/);
  assert.match(CODE, /if \(l\.d\.montant === null\) return;/);
  assert.match(CODE, /if \(montant < 1\) throw new Error\('montant nul refusé/);
});
test('budget : montant illisible refusé sans rien ouvrir', async () => {
  const a = await enCours();
  a.saisir('plafond', '12.5.5');
  await a.cliquer('ouvrir-cycle');
  assert.match(a.un('message').textContent, /^Plafond du cycle : montant « 12\.5\.5 » illisible/);
  assert.equal(a.copie().registre, null);
});
test('budget : un registre suspendu est affiché « SUSPENDU : anomalie de borne financière à examiner »', () => {
  let r = ouvrirRegistre({ cycle: 'c1', plafond: 100000000, reserve: 0, plafondRun: 10000000 }, '2026-10-17T09:00:00.000Z');
  r = appliquerBudget(r, { type: 'chantier-plafonne', quand: '2026-10-17T09:00:01.000Z', donnees: { chantier: 'x', plafond: 50000000 } });
  r = appliquerBudget(r, { type: 'engagement', quand: '2026-10-17T09:00:02.000Z', donnees: { execution: 'e1', chantier: 'x', maximum: 1000000 } });
  r = appliquerBudget(r, { type: 'cout', quand: '2026-10-17T09:00:03.000Z', donnees: { execution: 'e1', montant: 2000000 } });
  assert.equal(etatBudget(r).suspendu, true);
  const copie = { version: 1, mode: 'OFF', formulaire: { chantier: '', objectif: '', version: VERSION, sha: '', jalons: [{ id: '', titre: '', critere: '', tentativesMax: '2' }], budget: { cycle: '', plafond: '', reserve: '', plafondRun: '', plafondChantier: '' } }, fiches: {}, journal: null, registre: r, mission: null }; // MISE À JOUR DÉLIBÉRÉE v0.65.3 (correction avant dépôt) : + clé « mission »
  const a = monter({ stockage: stockageMemoire(JSON.stringify(copie)) });
  assert.equal(a.un('budget-suspendu').textContent, 'SUSPENDU : anomalie de borne financière à examiner');
});
test('journaux : « Journal du chantier (AT-1) » et « Registre de budget (AT-2) » affichés séparément, jamais fusionnés', async () => {
  const a = await enCours();
  await a.cliquer('ouvrir-cycle');
  const jc = a.un('journal-chantier');
  const rb = a.un('registre-budget');
  assert.notEqual(jc, rb);
  assert.equal(jc.children.length, 2);
  assert.equal(rb.children.length, 1);
  assert.ok(jc.children.every((li) => !/cycle-ouvert/.test(li.textContent)));
  assert.match(rb.children[0].textContent, /^1\. cycle-ouvert — .* plafond = 100,00 USD/);
  const t = a.texte();
  assert.ok(t.indexOf('Journal du chantier (AT-1)') < t.indexOf('Registre de budget (AT-2)'));
});

// ------------------------------------------------------------------------------------------------ copie locale
test('copie locale : une seule clé ; relue après démontage (mode, journal, registre, fiche)', async () => {
  const a = await enCours();
  await a.cliquer('ouvrir-cycle');
  a.saisir('comportement', 'Comportement repris.');
  assert.deepEqual(a.stockage.cles(), [CLE_ATELIER]);
  assert.equal(CLE_ATELIER, 'naissance-ia.atelier.v1');
  const b = monter({ stockage: a.stockage });
  assert.equal(b.un('mode').textContent, 'Mode : MANUEL');
  assert.equal(b.un('comportement').value, 'Comportement repris.');
  assert.deepEqual(b.copie().journal, a.copie().journal);
  assert.equal(b.un('budget-plafond').textContent, 'Plafond du cycle : 100,00 USD');
});
test('copie locale incohérente : déclarée illisible, rien n\'est utilisé ni réparé ni réécrit', async () => {
  const a = await enCours();
  const bonne = a.copie();
  const casses = [
    '{', JSON.stringify({ ...bonne, version: 4 }), JSON.stringify({ ...bonne, mode: 'AUTRE' }), // MISE À JOUR DÉLIBÉRÉE v0.65.9 (AUTO devient un mode connu : le mode inconnu devient AUTRE) ; MISE À JOUR DÉLIBÉRÉE v0.65.6 (la copie écrite est en version 2 : la version inconnue devient 3) ; MISE À JOUR DÉLIBÉRÉE v0.65.7 (version 3 écrite : l'inconnue devient 4)
    JSON.stringify({ ...bonne, journal: bonne.journal.map((e, i) => (i === 1 ? { ...e, n: 5 } : e)) }),
    JSON.stringify({ ...bonne, journal: [bonne.journal[1]] }),
    JSON.stringify({ ...bonne, registre: [{ n: 1, type: 'cout', quand: 'x', donnees: {} }] }),
    JSON.stringify({ ...bonne, fiches: { 'temoin-1': { comportement: 1 } } }),
  ];
  for (const brut of casses) {
    const s = stockageMemoire(brut);
    const b = monter({ stockage: s });
    assert.match(b.un('illisible').textContent, /^Copie locale illisible : rien n'est utilisé \(/, brut.slice(0, 40));
    for (const n of ['mode-manuel', 'generer', 'ouvrir', 'verifier', 'journal-chantier']) assert.equal(b.trouver(n).length, 0, n);
    assert.equal(s.ecritures, 0);
    assert.equal(s.getItem(CLE_ATELIER), brut);
  }
});
test('effacer : deux gestes, la clé est retirée, l\'atelier repart vide en OFF ; possible même illisible', async () => {
  const s = stockageMemoire('{');
  const a = monter({ stockage: s });
  await a.cliquer('effacer');
  assert.equal(s.effacements, 0);
  assert.match(a.un('effacer').textContent, /^Confirmer/);
  await a.cliquer('effacer');
  assert.equal(s.effacements, 1);
  assert.equal(s.getItem(CLE_ATELIER), null);
  assert.equal(a.un('mode').textContent, 'Mode : OFF');
  assert.equal(s.ecritures, 0);
});
test('rafraichir relit la copie locale et oublie le dossier, la copie et la vérification affichés', async () => {
  const a = await enCours();
  await a.cliquer('generer');
  assert.equal(a.trouver('dossier').length, 1);
  a.ecran.rafraichir();
  assert.equal(a.trouver('dossier').length, 0);
  assert.equal(a.un('mode').textContent, 'Mode : MANUEL');
});

// ------------------------------------------------------------------------------------------------ frontières statiques
test('module : deux exports ; imports exactement chantier, budget, mission, montants, verification, parcours, empreinte ; rien d\'autre', () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.6 (AT-6) : ecran.js raccorde aussi verification.js (lireFaits, confronter, lireDemande), parcours.js
  // (étapes dérivées) et empreinte.js (SHA-256 synchrone) ; toujours aucun import dynamique ni require.
  // MISE À JOUR DÉLIBÉRÉE v0.65.18 (AT-10.1) : + CLE_CARNET (copie locale séparée du carnet).
  assert.deepEqual(Object.keys(MODULE).sort(), ['CLE_ATELIER', 'CLE_CARNET', 'monterAtelier']);
  const imports = [...CODE.matchAll(/^\s*import\b[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]).sort();
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7) : + ./journal.js (état durable, parties k/N, restauration, confirmation).
  // MISE À JOUR DÉLIBÉRÉE v0.65.9 (AT-8.1) : + ./auto.js (identité T, demande AUTO, lecture des faits AUTO).
  // MISE À JOUR DÉLIBÉRÉE v0.65.18 (AT-10.1) : + ./carnet.js (carnet de trois missions, modèle pur).
  // MISE À JOUR DÉLIBÉRÉE v0.65.21 (AT-10.4) : + ./retour.js (lecture et contrôle du bloc ATELIER-RETOUR-1, modèle pur).
  assert.deepEqual(imports, ['./auto.js', './budget.js', './carnet.js', './chantier.js', './empreinte.js', './journal.js', './mission.js', './montants.js', './parcours.js', './retour.js', './verification.js']);
  assert.doesNotMatch(CODE, /\bimport\(|\brequire\(/);
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
});
test('seul ecran.js raccorde les modules purs ; chantier, budget, mission, montants n\'importent rien', () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.4 (AT-5) : verification.js, pur et dormant, importe UNIQUEMENT ./mission.js (verifierRapport,
  // construireMission) ; il n'est importé par aucun module de l'atelier, ecran.js compris ; les quatre modules purs restent sans import.
  // MISE À JOUR DÉLIBÉRÉE v0.65.6 (AT-6) : empreinte.js et parcours.js rejoignent les modules purs SANS import ; verification.js n'importe
  // toujours que ./mission.js et il est désormais importé par ecran.js SEUL (qui le raccorde au parcours MANUEL).
  for (const m of ['chantier.js', 'budget.js', 'mission.js', 'montants.js', 'empreinte.js', 'parcours.js']) {
    const c = sansCommentaires(readFileSync(join(ATELIER, m), 'utf8'));
    assert.doesNotMatch(c, /\bimport\b|\brequire\(/, m);
    for (const autre of ['chantier.js', 'budget.js', 'mission.js', 'montants.js', 'ecran.js', 'verification.js', 'empreinte.js', 'parcours.js']) if (autre !== m) assert.equal(new RegExp(`\\b${autre.replace('.', '\\.')}`).test(c), false, `${m} -> ${autre}`);
  }
  const v = sansCommentaires(readFileSync(join(ATELIER, 'verification.js'), 'utf8'));
  assert.deepEqual([...v.matchAll(/^\s*import\b[^;]*?from\s+'([^']+)'/gm)].map((x) => x[1]), ['./mission.js']);
  assert.equal((CODE.match(/from '\.\/verification\.js'/g) || []).length, 1);
});
test('aucun réseau, aucune API, aucun AUTO, aucun GitHub dans l\'atelier ; une seule clé de stockage', () => {
  for (const f of readdirSync(ATELIER).filter((n) => n.endsWith('.js'))) {
    const c = sansCommentaires(readFileSync(join(ATELIER, f), 'utf8'));
    for (const m of [/\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/, /https?:/, /indexedDB/, /anthropic/i, /github\.com|api\.github|\boctokit\b|\bgh\s/i, /\beval\(/, /new Function/, /innerHTML/]) assert.equal(m.test(c), false, `${f} ${m}`);
    // MISE À JOUR DÉLIBÉRÉE v0.65.9 (AT-8.1) : AUTO à blanc existe (sans réseau) ; il n'apparaît que dans auto.js, parcours.js et ecran.js.
    // MISE À JOUR DÉLIBÉRÉE v0.65.16 (AT-10.5) : journal.js lit aussi une tentative AUTO rendue (rapport dérivé, coût de J2), sans réseau.
    // MISE À JOUR DÉLIBÉRÉE v0.65.19 (AT-10.2) : carnet.js compare le lancement de la mission au mode AUTO approuvé, sans réseau.
    // MISE À JOUR DÉLIBÉRÉE v0.65.21 (AT-10.4) : retour.js relit les faits d'un run AUTO (transport par annotations), sans réseau.
    if (!['auto.js', 'parcours.js', 'ecran.js', 'journal.js', 'carnet.js', 'retour.js'].includes(f)) assert.equal(/\bAUTO\b/.test(c), false, `${f} AUTO`);
  }
  // MISE À JOUR DÉLIBÉRÉE v0.65.18 (AT-10.1) : une seconde clé, SÉPARÉE, pour la copie locale du carnet ; la clé du chantier est inchangée.
  assert.deepEqual(CODE.match(/naissance-ia\.[a-z.0-9-]+/g), ['naissance-ia.atelier.v1', 'naissance-ia.atelier.carnet.v1']);
  assert.deepEqual([...CODE.matchAll(/stockage\.(\w+)\(/g)].map((m) => m[1]).sort(), ['getItem', 'getItem', 'removeItem', 'removeItem', 'setItem', 'setItem']);
  assert.equal((CODE.match(/stockage\.setItem\(CLE_ATELIER/g) || []).length, 1);
  assert.equal((CODE.match(/stockage\.setItem\(CLE_CARNET/g) || []).length, 1);
});
test('aucun module de l\'atelier n\'importe un module cognitif (ni langage, ni mémoire, ni moteur)', () => {
  for (const f of readdirSync(ATELIER).filter((n) => n.endsWith('.js'))) {
    const c = sansCommentaires(readFileSync(join(ATELIER, f), 'utf8'));
    for (const m of c.matchAll(/from\s+'([^']+)'/g)) assert.match(m[1], /^\.\/[a-z]+\.js$/, `${f} -> ${m[1]}`);
  }
});
test('main.js : aucun import statique de l\'atelier ; import dynamique unique dans ouvrirAtelier, liée au seul toucher de l\'entrée', () => {
  const c = sansCommentaires(readFileSync(join(RACINE, 'app', 'main.js'), 'utf8'));
  assert.doesNotMatch(c, /^\s*import\b[^;(]*atelier/m);
  const debut = c.indexOf('async function ouvrirAtelier()');
  const fin = c.indexOf('\n}\n', debut);
  assert.ok(debut > 0 && fin > debut);
  assert.equal(c.split("import('./atelier/ecran.js')").length, 2);
  const corps = c.slice(debut, fin);
  assert.ok(corps.includes("await import('./atelier/ecran.js')"));
  assert.ok(corps.includes("if (panneauOuvert !== 'reglages') return;"));
  assert.deepEqual([...c.matchAll(/ouvrirAtelier\b[^(]/g)].length, 1);
  assert.ok(c.includes("document.querySelectorAll('[data-ouvrir-atelier]').forEach((b) => b.addEventListener('click', ouvrirAtelier));"));
  assert.equal((c.match(/ouvrirAtelier/g) || []).length, 2);
  assert.equal((c.match(/monterAtelier/g) || []).length, 2);
});
test('sw.js inchangé (empreintes de la base v0.65.2, seule la version injectée par le robot neutralisée) et ignorant de l\'atelier', () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.3 (refus robot du candidat a49e1b62…) : avant les tests, injecter_version() de .github/workflows/deballer.py
  // remplace, dans chaque ligne de app/**/*.js portant le marqueur VERSION_AUTO, la PREMIÈRE chaîne entre guillemets doubles par
  // "<version du colis>" (journal : « version injectée : app/sw.js »). L'empreinte du fichier entier ne peut donc pas être figée.
  // Forme canonique = exactement cette substitution, avec "<VERSION>" ; tout autre octet de app/sw.js reste comparé à la base.
  // La racine sw.js est hors de app/ : le robot n'y touche pas, son empreinte entière reste figée.
  const h = (t) => createHash('sha256').update(t).digest('hex');
  const sw = readFileSync(join(RACINE, 'app', 'sw.js'), 'utf8');
  const marquees = sw.split('\n').filter((l) => l.includes('VERSION_AUTO'));
  assert.deepEqual(marquees.length, 1);
  assert.match(marquees[0], /^const VERSION = "(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"; \/\/ VERSION_AUTO$/);
  const canonique = sw.split('\n').map((l) => (l.includes('VERSION_AUTO') ? l.replace(/"[^"\n]*"/, '"<VERSION>"') : l)).join('\n');
  assert.equal(h(canonique), 'f1258b11d65548a152e4d2f5fd165a3255c67613bf7386d4257944fb4369a40f');
  assert.equal(h(readFileSync(join(RACINE, 'sw.js'))), '62909c4ae56e50683f76491f51d24af9a229fabd224eecec338e4899858cad62');
  for (const p of [join('app', 'sw.js'), 'sw.js']) assert.doesNotMatch(readFileSync(join(RACINE, p), 'utf8'), /atelier/i);
});
test('base cognitive inchangée : VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables ; l\'atelier ne nomme aucune table', () => {
  assert.equal(VERSION_BASE, 30); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 20); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  for (const t of TABLES) assert.equal(CODE.includes(`'${t}'`), false, t);
});
