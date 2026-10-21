// v0.65.0 — AT-1 « MODÈLE DU CHANTIER » (GO « AUTORISATION AT-1 », 17/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune acquisition.
// Preuves : construction validée, transitions nominales, refus sans écriture, arrêt et blocage terminaux, journal append-only par
// construction (reçu inchangé, rendu gelé en profondeur, événement copié), état reconstruit par le seul rejeu, pureté et dormance,
// base / schéma / tables inchangés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path'; // MISE À JOUR DÉLIBÉRÉE v0.65.1 (sep, pour la garde de dormance)
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/chantier.js';
import { ouvrirChantier, appliquer, etatDe, verifierJournal } from '../app/atelier/chantier.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN = join(RACINE, 'app', 'atelier', 'chantier.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CODE = sansCommentaires(SRC);
const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });

const Q = '2026-10-17T06:00:00Z';
const PLAN = [
  { id: 'j1', titre: 'Premier', critere: 'c1', tentativesMax: 2 },
  { id: 'j2', titre: 'Second', critere: 'c2', tentativesMax: 1 },
];
const DONNEES = { id: 'demo-1', objectif: 'Démontrer le modèle', base: { sha: '9d3fcab', version: '0.64.33' }, plan: PLAN };
const ev = (type, donnees = {}) => ({ type, quand: Q, donnees });
const ouvrir = (d = DONNEES) => ouvrirChantier(structuredClone(d), Q);

// Applique une suite d'événements ; échoue au premier refus.
function suite(journal, ...evs) {
  let j = journal;
  for (const e of evs) {
    const r = appliquer(j, e);
    assert.ok(Array.isArray(r), `refus inattendu : ${r.raison}`);
    j = r;
  }
  return j;
}
const lancer = (jalon) => ev('tentative-lancee', { jalon });
const rendre = (jalon, numero) => ev('tentative-rendue', { jalon, numero, reference: `atelier/demo-1/${jalon}-t${numero}` });
const accepter = (jalon, numero) => ev('tentative-acceptee', { jalon, numero, motif: 'contrôles verts' });
const rejeter = (jalon, numero) => ev('tentative-rejetee', { jalon, numero, motif: 'tests rouges' });
const annuler = (jalon, numero) => ev('tentative-annulee', { jalon, numero, motif: 'annulée' });
const arreter = () => ev('chantier-arrete', { motif: 'STOP' });
const approuve = () => suite(ouvrir(), ev('plan-approuve'));
const refus = (journal, e) => { const r = appliquer(journal, e); assert.equal(r.refuse, true); assert.equal(typeof r.raison, 'string'); return r; };

// ------------------------------------------------------------------------------------------------ construction
test('ouverture valide : un seul événement « ouvert », état ouvert, jalons à faire', () => {
  const j = ouvrir();
  assert.equal(j.length, 1);
  assert.deepEqual({ n: j[0].n, type: j[0].type, quand: j[0].quand }, { n: 1, type: 'ouvert', quand: Q });
  const e = etatDe(j);
  assert.equal(e.statut, 'ouvert');
  assert.equal(e.jalonCourant, null);
  assert.deepEqual(e.plan.map((x) => x.statut), ['a-faire', 'a-faire']);
  assert.deepEqual(e.base, { sha: '9d3fcab', version: '0.64.33' });
});

test('refus : objectif vide (et quand absent)', () => {
  assert.throws(() => ouvrirChantier({ ...DONNEES, objectif: '  ' }, Q), TypeError);
  assert.throws(() => ouvrirChantier(structuredClone(DONNEES)), TypeError);
});

test('refus : plan vide', () => {
  assert.throws(() => ouvrirChantier({ ...DONNEES, plan: [] }, Q), TypeError);
});

test('refus : identifiants de jalons en double', () => {
  assert.throws(() => ouvrirChantier({ ...DONNEES, plan: [PLAN[0], { ...PLAN[1], id: 'j1' }] }, Q), /double/);
});

test('refus : tentativesMax < 1 ou non entier', () => {
  for (const m of [0, -1, 1.5, '2', null]) assert.throws(() => ouvrirChantier({ ...DONNEES, plan: [{ ...PLAN[0], tentativesMax: m }] }, Q), TypeError, String(m));
});

test('refus : base incomplète', () => {
  for (const base of [undefined, {}, { sha: '9d3fcab' }, { version: '0.64.33' }]) assert.throws(() => ouvrirChantier({ ...DONNEES, base }, Q), TypeError);
});

// ------------------------------------------------------------------------------------------------ transitions nominales
test('approuver : chantier en cours, premier jalon courant', () => {
  const e = etatDe(approuve());
  assert.equal(e.statut, 'en-cours');
  assert.equal(e.jalonCourant, 0);
});

test('lancer : jalon en cours, tentative n° 1 lancée', () => {
  const e = etatDe(suite(approuve(), lancer('j1')));
  assert.equal(e.plan[0].statut, 'en-cours');
  assert.deepEqual(e.plan[0].tentatives, [{ numero: 1, statut: 'lancee', reference: null, motif: null }]);
});

test('rendre : la tentative porte sa référence', () => {
  const t = etatDe(suite(approuve(), lancer('j1'), rendre('j1', 1))).plan[0].tentatives[0];
  assert.equal(t.statut, 'rendue');
  assert.equal(t.reference, 'atelier/demo-1/j1-t1');
});

test('accepter : jalon accepté, le jalon suivant devient courant', () => {
  const e = etatDe(suite(approuve(), lancer('j1'), rendre('j1', 1), accepter('j1', 1)));
  assert.equal(e.plan[0].statut, 'accepte');
  assert.equal(e.plan[0].tentatives[0].statut, 'acceptee');
  assert.equal(e.jalonCourant, 1);
  assert.equal(e.statut, 'en-cours');
});

test('accepter le dernier jalon : chantier terminé', () => {
  const e = etatDe(suite(approuve(), lancer('j1'), rendre('j1', 1), accepter('j1', 1), lancer('j2'), rendre('j2', 1), accepter('j2', 1)));
  assert.equal(e.statut, 'termine');
  assert.equal(e.jalonCourant, null);
});

test('rejeter puis relancer : tentative n° 2', () => {
  const e = etatDe(suite(approuve(), lancer('j1'), rendre('j1', 1), rejeter('j1', 1), lancer('j1')));
  assert.deepEqual(e.plan[0].tentatives.map((t) => [t.numero, t.statut]), [[1, 'rejetee'], [2, 'lancee']]);
});

test('rejeter à la dernière tentative : jalon et chantier bloqués', () => {
  const e = etatDe(suite(approuve(), lancer('j1'), rendre('j1', 1), rejeter('j1', 1), lancer('j1'), rendre('j1', 2), rejeter('j1', 2)));
  assert.equal(e.plan[0].statut, 'bloque');
  assert.equal(e.statut, 'bloque');
});

test('annuler compte comme une tentative consommée', () => {
  const e = etatDe(suite(approuve(), lancer('j1'), annuler('j1', 1), lancer('j1'), annuler('j1', 2)));
  assert.deepEqual(e.plan[0].tentatives.map((t) => t.statut), ['annulee', 'annulee']);
  assert.equal(e.statut, 'bloque');
});

// ------------------------------------------------------------------------------------------------ refus : rien n'est écrit
test('refus : approuver deux fois', () => { refus(approuve(), ev('plan-approuve')); });
test('refus : lancer avant approbation', () => { refus(ouvrir(), lancer('j1')); });
test('refus : deux tentatives vivantes', () => { refus(suite(approuve(), lancer('j1')), lancer('j1')); refus(suite(approuve(), lancer('j1'), rendre('j1', 1)), lancer('j1')); });
test('refus : lancer sur un jalon non courant', () => { refus(approuve(), lancer('j2')); refus(approuve(), lancer('inconnu')); });
test('refus : accepter ou rejeter une tentative non rendue', () => { const j = suite(approuve(), lancer('j1')); refus(j, accepter('j1', 1)); refus(j, rejeter('j1', 1)); });
test('refus : rendre une tentative déjà rendue ou inexistante', () => { const j = suite(approuve(), lancer('j1'), rendre('j1', 1)); refus(j, rendre('j1', 1)); refus(j, rendre('j1', 2)); });
test('refus : tout événement sur un chantier terminé', () => {
  const j = suite(approuve(), lancer('j1'), rendre('j1', 1), accepter('j1', 1), lancer('j2'), rendre('j2', 1), accepter('j2', 1));
  for (const e of [lancer('j2'), arreter(), ev('plan-approuve')]) refus(j, e);
});
test('refus : tout événement sur un chantier arrêté', () => {
  const j = suite(approuve(), arreter());
  for (const e of [lancer('j1'), arreter(), ev('plan-approuve')]) refus(j, e);
});
test('refus : type inconnu, numérotation imposée fausse, « quand » absent', () => {
  const j = approuve();
  refus(j, ev('plan-modifie'));
  refus(j, { ...lancer('j1'), n: 7 });
  refus(j, { type: 'tentative-lancee', donnees: { jalon: 'j1' } });
});
test('refus : un chantier bloqué ne se débloque pas, il ne peut qu\'être arrêté', () => {
  const j = suite(approuve(), lancer('j1'), annuler('j1', 1), lancer('j1'), annuler('j1', 2));
  for (const e of [lancer('j1'), lancer('j2'), ev('plan-approuve'), ev('ouvert', DONNEES)]) refus(j, e);
  assert.equal(etatDe(suite(j, arreter())).statut, 'arrete');
});
test('un refus ne modifie pas le journal reçu', () => {
  const j = suite(approuve(), lancer('j1'));
  const avant = JSON.stringify(j);
  refus(j, lancer('j1'));
  assert.equal(JSON.stringify(j), avant);
  assert.equal(j.length, 3);
});

// ------------------------------------------------------------------------------------------------ arrêt
test('arrêter en cours avec une tentative vivante : tentative annulée, chantier arrêté', () => {
  const e = etatDe(suite(approuve(), lancer('j1'), rendre('j1', 1), arreter()));
  assert.equal(e.statut, 'arrete');
  assert.deepEqual([e.plan[0].tentatives[0].statut, e.plan[0].tentatives[0].motif], ['annulee', 'STOP']);
});
test('arrêter un chantier ouvert ou bloqué', () => {
  assert.equal(etatDe(suite(ouvrir(), arreter())).statut, 'arrete');
  const b = suite(approuve(), lancer('j1'), annuler('j1', 1), lancer('j1'), annuler('j1', 2));
  assert.equal(etatDe(suite(b, arreter())).statut, 'arrete');
  refus(b, ev('chantier-arrete', {}));
});

// ------------------------------------------------------------------------------------------------ journal append-only
test('n continu à partir de 1', () => {
  const j = suite(approuve(), lancer('j1'), rendre('j1', 1), accepter('j1', 1));
  assert.deepEqual(j.map((e) => e.n), [1, 2, 3, 4, 5]);
});
test('appliquer ne modifie pas le journal reçu (égalité profonde avant / après, même longueur)', () => {
  const j = suite(approuve(), lancer('j1'));
  const copie = structuredClone(j);
  const nouveau = appliquer(j, rendre('j1', 1));
  assert.deepEqual(j, copie);
  assert.equal(j.length, 3);
  assert.notEqual(nouveau, j);
  assert.deepEqual(nouveau.slice(0, 3), copie);
});
test('le journal rendu est gelé en profondeur : aucune modification rétroactive possible', () => {
  const j = suite(approuve(), lancer('j1'), rendre('j1', 1));
  assert.ok(Object.isFrozen(j));
  for (const e of j) { assert.ok(Object.isFrozen(e)); assert.ok(Object.isFrozen(e.donnees)); }
  assert.ok(Object.isFrozen(j[0].donnees.plan) && Object.isFrozen(j[0].donnees.plan[0]) && Object.isFrozen(j[0].donnees.base));
  assert.throws(() => { j.push({}); }, TypeError);
  assert.throws(() => { j[3].donnees.reference = 'autre'; }, TypeError);
  assert.throws(() => { j[0].donnees.plan[0].tentativesMax = 99; }, TypeError);
  assert.throws(() => { j[0].donnees.plan.push({ id: 'j3' }); }, TypeError);
  assert.equal(etatDe(j).plan[0].tentatives[0].reference, 'atelier/demo-1/j1-t1');
});
test('les objets fournis par l\'appelant sont copiés : les changer après coup ne change pas le journal', () => {
  const d = structuredClone(DONNEES);
  const j = ouvrirChantier(d, Q);
  d.objectif = 'détourné'; d.plan[0].tentativesMax = 99; d.base.sha = 'x';
  const e = lancer('j1');
  const j2 = suite(appliquer(j, ev('plan-approuve')), e);
  e.donnees.jalon = 'j2';
  const etat = etatDe(j2);
  assert.deepEqual([etat.objectif, etat.plan[0].tentativesMax, etat.base.sha], ['Démontrer le modèle', 2, '9d3fcab']);
  assert.equal(j2[2].donnees.jalon, 'j1');
});
test('verifierJournal détecte un trou, une réécriture, un premier événement autre que « ouvert »', () => {
  const j = structuredClone(suite(approuve(), lancer('j1'), rendre('j1', 1), accepter('j1', 1)));
  assert.deepEqual(verifierJournal(j), { ok: true });
  const trou = [j[0], j[1], j[3]];
  assert.equal(verifierJournal(trou).ok, false);
  assert.equal(verifierJournal(trou).n, 3);
  const reecrit = structuredClone(j); reecrit[3].type = 'tentative-acceptee'; // l'acceptation remplace le rendu : incohérent
  assert.deepEqual([verifierJournal(reecrit).ok, verifierJournal(reecrit).n], [false, 4]);
  const sansOuvert = j.slice(1).map((e, i) => ({ ...e, n: i + 1 }));
  assert.deepEqual([verifierJournal(sansOuvert).ok, verifierJournal(sansOuvert).n], [false, 1]);
  assert.equal(verifierJournal([]).ok, false);
  assert.throws(() => etatDe(reecrit), TypeError);
  assert.equal(appliquer(reecrit, lancer('j2')).refuse, true);
});
test('le rejeu seul reconstruit exactement l\'état : journal de 12 événements, sérialisé puis relu', () => {
  const evs = [ev('plan-approuve'), lancer('j1'), rendre('j1', 1), rejeter('j1', 1), lancer('j1'), rendre('j1', 2), accepter('j1', 2), lancer('j2'), rendre('j2', 1), accepter('j2', 1)];
  let j = ouvrir();
  const etats = [etatDe(j)];
  for (const e of evs) { j = suite(j, e); etats.push(etatDe(j)); }
  assert.equal(j.length, 11);
  const relu = JSON.parse(JSON.stringify(j)); // aucune donnée cachée : le texte JSON du journal suffit
  assert.deepEqual(etatDe(relu), etats.at(-1));
  for (let k = 1; k <= relu.length; k += 1) assert.deepEqual(etatDe(relu.slice(0, k)), etats[k - 1], `préfixe ${k}`);
  assert.deepEqual(etatDe(relu), etatDe(relu)); // même journal ⇒ même état
  const douze = suite(suite(approuve(), lancer('j1'), rendre('j1', 1), rejeter('j1', 1), lancer('j1'), rendre('j1', 2), accepter('j1', 2)), lancer('j2'), rendre('j2', 1), rejeter('j2', 1), arreter());
  assert.equal(douze.length, 12);
  assert.deepEqual(etatDe(JSON.parse(JSON.stringify(douze))), etatDe(douze));
  assert.equal(etatDe(douze).statut, 'arrete');
});
test('une clé inconnue de « donnees » est conservée telle quelle', () => {
  const j = suite(approuve(), ev('tentative-lancee', { jalon: 'j1', note: { libre: [1, 2] } }));
  assert.deepEqual(j[2].donnees, { jalon: 'j1', note: { libre: [1, 2] } });
  assert.equal(verifierJournal(j).ok, true);
});

// ------------------------------------------------------------------------------------------------ gardes statiques
test('pureté : aucun import, aucune horloge, aucun hasard, aucune persistance, aucun réseau, aucun DOM', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['appliquer', 'etatDe', 'ouvrirChantier', 'verifierJournal']);
  assert.doesNotMatch(CODE, /\bimport\b|\brequire\(/);
  for (const m of [/\bDate\b/, /Math\.random/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bfetch\b/, /localStorage/, /indexedDB/, /magasin/, /lireTout/, /ecrire/, /enregistrer/, /\basync\b/, /\bawait\b/, /\bdocument\b/, /\bnavigator\b/, /\bglobalThis\b/, /\bwindow\b/, /\bprocess\b/, /performance\./]) assert.equal(m.test(CODE), false, String(m));
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  assert.ok(SRC.split('\n').length < 200);
});
test('dormance : aucun fichier de app/ n\'importe le module ; hors app/atelier/, seul main.js atteint l\'atelier, par l\'import dynamique de ecran.js', () => { // MISE À JOUR DÉLIBÉRÉE v0.65.3 (titre : la dormance totale devient un branchement unique et paresseux)
  // MISE À JOUR DÉLIBÉRÉE v0.65.1 (AT-2 ajoute légitimement app/atelier/budget.js) : l'exclusion « f !== CHEMIN » devient « tout
  // fichier de app/atelier/ », et budget.js est ajouté aux noms cherchés ; intention inchangée : rien hors de l'atelier ne le référence.
  // MISE À JOUR DÉLIBÉRÉE v0.65.2 (AT-3 ajoute app/atelier/mission.js) : « mission.js » ajouté aux noms cherchés hors de l'atelier
  // (\b : « emission.js » du moteur n'est pas l'atelier) ; intention inchangée.
  // MISE À JOUR DÉLIBÉRÉE v0.65.3 (AT-4 branche l'écran de l'atelier) : la dormance totale est REMPLACÉE, non supprimée, par une preuve
  // plus étroite : hors de app/atelier/, seul app/main.js mentionne l'atelier, et seulement par l'import dynamique unique
  // « import('./atelier/ecran.js') » (aucun import statique) ; index.html ne contient que la section #atelier vide et l'entrée des Réglages ;
  // sw.js ignore toujours l'atelier.
  // MISE À JOUR DÉLIBÉRÉE v0.65.4 (AT-5 ajoute app/atelier/verification.js) : « verification.js » ajouté aux noms cherchés hors de
  // l'atelier ; intention inchangée : hors de app/atelier/, seul main.js atteint l'atelier, et seulement par ecran.js.
  // v0.65.6 (AT-6 ajoute empreinte.js et parcours.js) : leurs noms nus ne sont PAS cherchés (des modules cognitifs ont leur propre
  // « empreinte.js » sans lien) ; tout chemin vers eux passe par « atelier/ », déjà cherché. Intention inchangée.
  const dehors = fichiersJs(join(RACINE, 'app')).filter((f) => !f.startsWith(join(RACINE, 'app', 'atelier') + sep) && /chantier\.js|budget\.js|\bmission\.js|montants\.js|\bverification\.js|atelier\//.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f));
  assert.deepEqual(dehors, [join('app', 'main.js')]);
  const codeMain = readFileSync(join(RACINE, 'app', 'main.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  assert.deepEqual(codeMain.match(/[^\s(]*atelier\/[^\s)]*/g), ["'./atelier/ecran.js'"]);
  assert.equal(codeMain.split("import('./atelier/ecran.js')").length, 2);
  assert.doesNotMatch(codeMain, /^\s*import\b[^;(]*atelier/m);
  // MISE À JOUR DÉLIBÉRÉE v0.65.1 (AT-2) : app/atelier/ contient exactement les modules autorisés, chantier.js et budget.js.
  // MISE À JOUR DÉLIBÉRÉE v0.65.2 (AT-3) : la liste exacte des modules autorisés gagne mission.js.
  // MISE À JOUR DÉLIBÉRÉE v0.65.3 (AT-4) : la liste exacte gagne ecran.js (seul module d'interface) et montants.js (frontière pure).
  // MISE À JOUR DÉLIBÉRÉE v0.65.4 (AT-5) : la liste exacte gagne verification.js (pur et dormant : aucun appelant en production).
  // MISE À JOUR DÉLIBÉRÉE v0.65.6 (AT-6) : la liste exacte gagne empreinte.js (SHA-256 synchrone pur) et parcours.js (étapes dérivées, pur).
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7) : la liste exacte gagne journal.js (état durable et transport k/N, pur ; importé par ecran.js seul).
  // MISE À JOUR DÉLIBÉRÉE v0.65.9 (AT-8.1) : la liste exacte gagne auto.js (chemin AUTO à blanc, pur, sans réseau ; importé par ecran.js seul).
  // MISE À JOUR DÉLIBÉRÉE v0.65.18 (AT-10.1) : la liste exacte gagne carnet.js (carnet de trois missions, pur, sans réseau ; importé par ecran.js
  // et outils-atelier/auto-carnet.mjs seulement).
  assert.deepEqual(fichiersJs(join(RACINE, 'app', 'atelier')).map((f) => relative(RACINE, f)).sort(), ['auto.js', 'budget.js', 'carnet.js', 'chantier.js', 'ecran.js', 'empreinte.js', 'journal.js', 'mission.js', 'montants.js', 'parcours.js', 'verification.js'].map((n) => join('app', 'atelier', n)));
  assert.equal(readFileSync(join(RACINE, 'app', 'atelier', 'budget.js'), 'utf8').includes('chantier.js'), false);
  assert.equal(readFileSync(join(RACINE, 'app', 'sw.js'), 'utf8').includes('atelier'), false);
  const SECTION = '<section id="atelier" class="panneau" hidden aria-label="Atelier de développement">\n    <header class="entete">\n      <button type="button" class="bouton-secondaire" data-fermer-panneau>← Retour</button>\n      <h2>Atelier</h2>\n    </header>\n    <div class="contenu-reglages" data-atelier-contenu></div>\n  </section>';
  const ENTREE = '<button type="button" class="bouton-secondaire" data-ouvrir-atelier>Atelier de développement →</button>';
  const html = readFileSync(join(RACINE, 'app', 'index.html'), 'utf8');
  assert.equal(html.split(SECTION).length, 2);
  assert.equal(html.split(ENTREE).length, 2);
  assert.doesNotMatch(html.replace(SECTION, '').replace(ENTREE, ''), /atelier/i);
});
test('base cognitive inchangée : VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables', () => {
  assert.equal(VERSION_BASE, 29);
  assert.equal(SCHEMA_SAUVEGARDE, 19);
  assert.equal(TABLES.length, 35);
});
