// v0.65.18 — AT-10.1 « CARNET DE TROIS MISSIONS » (GO « AT-10.1 — GO RÉALISATION LOCALE », 21/10/2026 ; D-007). OUTILLAGE NON COGNITIF.
// Preuves du modèle pur : exactement trois missions immuables après V1, ordre strict, plafonds individuels et global, budget confirmé /
// réservé sans double comptage (coût inconnu = plafond réservé), arrêt au premier échec, livraison seulement sur preuve exacte, journal
// append-only rejoué, forme durable canonique, lecture d'un chantier de mission (divergence), pureté et isolement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BORNES_CARNET, lireProposition, empreinteProposition, ouvrirCarnet, appliquerCarnet, etatCarnet, verifierCarnet, budgetCarnet,
  etatDurableCarnet, lireEtatCarnet, comparerCarnets, bilanChantier, comparerChantier, formulaireMission, texteLivraison, lireLivraison,
  chantierDeMission, preparationMission,
} from '../app/atelier/carnet.js';
import { canonique } from '../app/atelier/journal.js';
import { appliquerBudget } from '../app/atelier/budget.js';
import { Q, BASE, CARNET, APPEL, DEV, mission, proposition, ev, suite, sha, livraison, baseDe, ouverte, chantierMission, chantierPrepare, instantane } from './atelier-carnet-aide.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(RACINE, 'app', 'atelier', 'carnet.js'), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CODE = sansCommentaires(SRC);
const fichiers = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === 'node_modules' || n.startsWith('.') ? [] : fichiers(p)) : /\.(m?js)$/.test(n) ? [p] : []; });

const approuver = (p = proposition()) => suite(ouvrirCarnet(p, Q), ev('carnet-approuve', { empreinte: empreinteProposition(p) }));
const refus = (j, e, motif) => { const r = appliquerCarnet(j, e); assert.equal(r.refuse, true, `refus attendu pour ${e.type}`); if (motif) assert.match(r.raison, motif); return r; };
// Carnet mené jusqu'à la mission k validée (k = 0 : approuvé seulement).
function jusqua(k, p = proposition()) {
  let j = approuver(p);
  for (let i = 1; i <= k; i += 1) j = suite(j, ouverte(i), ev('mission-livree', livraison(i)), ev('mission-validee', { k: i }));
  return j;
}

test('carnet : la proposition fictive de trois missions est lue et gelée', () => {
  const l = lireProposition(proposition());
  assert.equal(l.raison, undefined);
  assert.ok(Object.isFrozen(l.proposition) && Object.isFrozen(l.proposition.missions[2].jalon));
  assert.deepEqual(BORNES_CARNET, { missions: 3, plafond_mission: 500000, plafond_total: 1000000 });
  assert.equal(chantierDeMission(CARNET, 2), 'carnet-essai-m2');
});

test('carnet : exactement trois missions (deux ou quatre refusées)', () => {
  const p = proposition();
  assert.match(lireProposition({ ...p, missions: p.missions.slice(0, 2) }).raison, /exactement 3 missions/);
  assert.match(lireProposition({ ...p, missions: [...p.missions, mission(4)] }).raison, /exactement 3 missions/);
  assert.match(lireProposition({ ...p, missions: [] }).raison, /exactement 3 missions/);
});

test('carnet : plafonds individuels et global (égalité acceptée, une unité de plus refusée)', () => {
  const p = proposition({ missions: [mission(1, { plafond: 500000 }), mission(2, { plafond: 300000 }), mission(3, { plafond: 200000 })] });
  assert.equal(lireProposition(p).raison, undefined);
  assert.match(lireProposition({ ...p, missions: [mission(1, { plafond: 500001 }), mission(2), mission(3)] }).raison, /plafond hors bornes/);
  assert.match(lireProposition({ ...p, missions: [mission(1, { plafond: 500000 }), mission(2, { plafond: 300001 }), mission(3, { plafond: 200000 })] }).raison, /somme des plafonds des missions \(1000001\)/);
  assert.match(lireProposition(proposition({ plafond_total: 1000001, limite_espace: 2000000 })).raison, /plafond total hors bornes/);
  assert.match(lireProposition(proposition({ plafond_total: 449999 })).raison, /somme des plafonds/);
  assert.match(lireProposition(proposition({ limite_espace: 999999 })).raison, /limite déclarée de l'espace/);
  assert.match(lireProposition(proposition({ missions: [mission(1, { plafond: 0 }), mission(2), mission(3)] })).raison, /plafond hors bornes/);
  // Le coût maximal de l'appel doit tenir sous le plafond de la mission (101 200 microdollars ici).
  assert.equal(lireProposition(proposition({ missions: [mission(1, { plafond: 101200 }), mission(2), mission(3)] })).raison, undefined);
  assert.match(lireProposition(proposition({ missions: [mission(1, { plafond: 101199 }), mission(2), mission(3)] })).raison, /coût maximal de l'appel \(101200\)/);
});

test('carnet : périmètre limité à l\'outillage de l\'atelier, chemins P1 et cognitifs refusés', () => {
  const avec = (autorises) => lireProposition(proposition({ missions: [mission(1, { autorises }), mission(2), mission(3)] })).raison;
  assert.match(avec(['app/atelier/auto.js']), /périmètre refusé \(perimetre-privilegie\)/);
  assert.match(avec(['outils-atelier/auto-carnet.mjs']), /perimetre-privilegie/);
  assert.match(avec(['app/moteur/raisonnement.js']), /hors de l'outillage/);
  assert.match(avec(['app/langage/connaissances.js']), /hors de l'outillage/);
  assert.match(avec(['VERSION']), /hors de l'outillage/);
  assert.match(avec(['app/atelier/']), /perimetre-dossier/);
  assert.match(avec(['.github/workflows/robot.yml']), /hors de l'outillage/);
});

test('carnet : forme de la proposition (clés, protocole, identifiant, base, appel, développement, dossier)', () => {
  const p = proposition();
  assert.match(lireProposition({ ...p, autre: 1 }).raison, /clés de la proposition/);
  assert.match(lireProposition({ ...p, protocole: 'x' }).raison, /protocole inconnu/);
  assert.match(lireProposition({ ...p, carnet: 'essai' }).raison, /identifiant du carnet/);
  assert.match(lireProposition({ ...p, carnet: `carnet-${'a'.repeat(31)}` }).raison, /identifiant du carnet/);
  assert.equal(lireProposition({ ...p, carnet: `carnet-${'a'.repeat(30)}` }).raison, undefined);
  assert.match(lireProposition({ ...p, carnet: 'carnet-x-m1' }).raison, /réservé aux chantiers des missions/);
  assert.match(lireProposition({ ...p, base: { sha: 'x', version: '0.65.17' } }).raison, /base invalide/);
  assert.match(lireProposition({ ...p, missions: [mission(1, { appel: { ...p.missions[0].appel, appels: 2 } }), mission(2), mission(3)] }).raison, /appel invalide/);
  assert.match(lireProposition({ ...p, missions: [mission(1, { developpement: { effort: 'max', extraits: [], tarif_entree: 3, tarif_sortie: 15 } }), mission(2), mission(3)] }).raison, /développement invalide/);
  assert.match(lireProposition({ ...p, missions: [mission(1, { objectif: ' ' }), mission(2), mission(3)] }).raison, /dossier impossible/);
  assert.match(lireProposition({ ...p, missions: [mission(1, { extra: 1 }), mission(2), mission(3)] }).raison, /clés inattendues/);
  const sansCritere = mission(1); delete sansCritere.jalon.critere;
  assert.match(lireProposition({ ...p, missions: [sansCritere, mission(2), mission(3)] }).raison, /jalon incomplet/);
  assert.throws(() => ouvrirCarnet({ ...p, missions: [] }, Q), TypeError);
  assert.throws(() => ouvrirCarnet(p, ''), TypeError);
});

test('carnet : V1 obligatoire, sur l\'empreinte exacte, une seule fois', () => {
  const p = proposition();
  const j = ouvrirCarnet(p, Q);
  assert.equal(etatCarnet(j).statut, 'brouillon');
  refus(j, ouverte(1), /non approuvé \(V1\)/);
  refus(j, ev('carnet-approuve', { empreinte: '0'.repeat(64) }), /empreinte approuvée différente/);
  const a = suite(j, ev('carnet-approuve', { empreinte: empreinteProposition(p) }));
  assert.equal(etatCarnet(a).statut, 'approuve');
  refus(a, ev('carnet-approuve', { empreinte: empreinteProposition(p) }), /déjà approuvé/);
  refus(a, ev('carnet-ouvert', p), /déjà ouvert/);
});

test('carnet : missions immuables après V1 (une mission modifiée dans le journal le rend incohérent)', () => {
  const j = jusqua(1);
  const triche = structuredClone(j);
  triche[0].donnees.missions[1].plafond = 160000;
  assert.deepEqual(verifierCarnet(triche), { ok: false, n: 2, raison: 'empreinte approuvée différente de celle du carnet ouvert' });
  assert.throws(() => etatCarnet(triche), /journal incohérent \(événement 2\)/);
  assert.equal(appliquerCarnet(triche, ouverte(2)).refuse, true);
  // Aucun événement ne porte de nouvelle mission : un type inconnu est refusé.
  refus(j, ev('mission-ajoutee', { k: 4 }), /mal formé/);
});

test('carnet : ordre strict (mission 2 avant 1, 4e mission, mission suivante avant validation, chantier ou base faux)', () => {
  const j = jusqua(0);
  refus(j, ouverte(2), /mission 1 attendue \(ordre strict\)/);
  refus(j, ev('mission-ouverte', { k: 4, chantier: `${CARNET}-m4`, base: BASE }), /hors du carnet/);
  refus(j, ev('mission-ouverte', { k: 0, chantier: `${CARNET}-m0`, base: BASE }), /hors du carnet/);
  refus(j, ev('mission-ouverte', { k: 1, chantier: 'autre-m1', base: BASE }), /chantier « carnet-essai-m1 » attendu/);
  refus(j, ev('mission-ouverte', { k: 1, chantier: `${CARNET}-m1`, base: { ...BASE, version: '0.65.16' } }), /base de la mission 1/);
  refus(j, ev('mission-ouverte', { k: 1, chantier: `${CARNET}-m1`, base: { ...BASE, sha: sha('f') } }), /base de la mission 1/);
  const o = suite(j, ouverte(1));
  refus(o, ouverte(1), /mission 1 non validée/);
  refus(o, ouverte(2), /mission 1 non validée/);
  const l = suite(o, ev('mission-livree', livraison(1)));
  refus(l, ouverte(2), /mission 1 non validée/);
  const v = suite(l, ev('mission-validee', { k: 1 }));
  // La base de la mission 2 est la livraison de la mission 1, et rien d'autre.
  refus(v, ev('mission-ouverte', { k: 2, chantier: `${CARNET}-m2`, base: BASE }), /base de la mission 2/);
  refus(v, ouverte(3), /mission 2 attendue/);
  const e = etatCarnet(suite(v, ouverte(2)));
  assert.deepEqual(e.missions[1].base, { sha: sha('1'), version: '0.65.18' });
  const fin = jusqua(3);
  assert.equal(etatCarnet(fin).statut, 'termine');
  refus(fin, ev('mission-ouverte', { k: 4, chantier: `${CARNET}-m4`, base: baseDe(4) }), /carnet terminé/);
});

test('carnet : budget — réservé à l\'ouverture, confirmé une seule fois, coût inconnu = plafond réservé', () => {
  let j = jusqua(0);
  assert.deepEqual(etatCarnet(j).budget, { confirme: 0, reserve: 0, disponible: 1000000 });
  j = suite(j, ouverte(1));
  assert.deepEqual(etatCarnet(j).budget, { confirme: 0, reserve: 150000, disponible: 850000 });
  j = suite(j, ev('mission-livree', livraison(1, { cout: 120000 })));
  assert.deepEqual(etatCarnet(j).budget, { confirme: 120000, reserve: 0, disponible: 880000 });
  j = suite(j, ev('mission-validee', { k: 1 }));
  assert.deepEqual(etatCarnet(j).budget, { confirme: 120000, reserve: 0, disponible: 880000 }, 'aucun double comptage à la validation');
  j = suite(j, ouverte(2));
  assert.deepEqual(etatCarnet(j).budget, { confirme: 120000, reserve: 150000, disponible: 730000 });
  // Clôture à coût inconnu : la réservation entière reste, rien n'est confirmé.
  const inconnu = suite(j, ev('mission-close', { k: 2, issue: 'issue-inconnue', cout: null }));
  assert.deepEqual(etatCarnet(inconnu).budget, { confirme: 120000, reserve: 150000, disponible: 730000 });
  refus(j, ev('mission-close', { k: 2, issue: 'issue-inconnue', cout: 0 }), /réservation conservée/);
  refus(j, ev('mission-close', { k: 2, issue: 'refusee', cout: null }), /coût de la mission invalide/);
  refus(j, ev('mission-close', { k: 2, issue: 'refusee', cout: -1 }), /coût de la mission invalide/);
  const connu = suite(j, ev('mission-close', { k: 2, issue: 'refusee', cout: 90000 }));
  assert.deepEqual(etatCarnet(connu).budget, { confirme: 210000, reserve: 0, disponible: 790000 });
  // Dépassement : un coût livré au-dessus du plafond de la mission est refusé (STOP), égalité acceptée.
  refus(j, ev('mission-livree', livraison(2, { cout: 150001 })), /au-dessus de son plafond.*STOP/);
  assert.equal(etatCarnet(suite(j, ev('mission-livree', livraison(2, { cout: 150000 })))).budget.confirme, 270000);
  assert.deepEqual(budgetCarnet(etatCarnet(j)), etatCarnet(j).budget);
});

test('carnet : refus d\'ouverture quand le plafond dépasse le disponible (garde de défense)', () => {
  // Inatteignable par les seuls événements valides (coût <= plafond, somme des plafonds <= total) : prouvé sur un état forgé.
  const e = structuredClone(etatCarnet(jusqua(0)));
  e.plafond_total = 100000;
  assert.equal(budgetCarnet(e).disponible, 100000);
  const j = jusqua(0);
  const forge = structuredClone(j);
  forge[0].donnees.plafond_total = 450000;
  forge[1].donnees.empreinte = empreinteProposition(forge[0].donnees);
  const ok = suite(forge, ouverte(1), ev('mission-livree', livraison(1, { cout: 150000 })), ev('mission-validee', { k: 1 }), ouverte(2));
  assert.equal(etatCarnet(ok).budget.disponible, 150000);
});

test('carnet : échec, refus ou issue inconnue = carnet bloqué, aucune relance, seul l\'arrêt reste', () => {
  for (const [issue, cout] of [['refusee', 1000], ['sans-candidat', 0], ['issue-inconnue', null], ['arretee', 0]]) {
    const j = suite(jusqua(0), ouverte(1), ev('mission-close', { k: 1, issue, cout }));
    const e = etatCarnet(j);
    assert.equal(e.statut, 'bloque');
    assert.equal(e.missions[0].statut, 'close');
    refus(j, ouverte(1), /carnet bloqué/);
    refus(j, ouverte(2), /carnet bloqué/);
    refus(j, ev('mission-livree', livraison(1)), /carnet bloqué/);
    const a = suite(j, ev('carnet-arrete', { motif: 'échec de la mission 1' }));
    assert.equal(etatCarnet(a).statut, 'arrete');
    refus(a, ouverte(1), /carnet arrêté/);
  }
  refus(suite(jusqua(0), ouverte(1)), ev('mission-close', { k: 1, issue: 'relance', cout: 0 }), /issue de clôture inconnue/);
  refus(jusqua(0), ev('carnet-arrete', { motif: ' ' }), /motif/);
});

test('carnet : mission-livree exige une preuve exacte (carnet, chantier, version supérieure, main nouveau, champs complets)', () => {
  const j = suite(jusqua(0), ouverte(1));
  refus(jusqua(0), ev('mission-livree', livraison(1)), /ce n'est pas la mission en cours/);
  refus(j, ev('mission-livree', livraison(1, { carnet: 'carnet-autre' })), /autre carnet/);
  refus(j, ev('mission-livree', livraison(1, { chantier: 'carnet-essai-m2' })), /autre chantier/);
  refus(j, ev('mission-livree', livraison(1, { version: '0.65.17' })), /non supérieure à la base 0\.65\.17/);
  refus(j, ev('mission-livree', livraison(1, { version: '0.64.99' })), /non supérieure/);
  refus(j, ev('mission-livree', livraison(1, { main: BASE.sha })), /égal à la base/);
  refus(j, ev('mission-livree', livraison(1, { preuve: 'x' })), /illisible/);
  refus(j, ev('mission-livree', livraison(1, { version: '0.65.99999' })), /illisible/);
  const sans = livraison(1); delete sans.candidat;
  refus(j, ev('mission-livree', sans), /incomplète/);
  refus(j, ev('mission-livree', { ...livraison(1), k: 2 }), /pas la mission en cours/);
  refus(j, ev('mission-validee', { k: 1 }), /non livrée/);
  const l = suite(j, ev('mission-livree', livraison(1)));
  refus(l, ev('mission-livree', livraison(1)), /non ouverte/);
  refus(l, ev('mission-close', { k: 1, issue: 'refusee', cout: 0 }), /non ouverte/);
  assert.deepEqual(etatCarnet(l).missions[0].livraison, { version: '0.65.18', main: sha('1'), candidat: sha('b'), preuve: '1'.repeat(64) });
});

test('carnet : parcours complet jusqu\'à « termine », état final et budget', () => {
  const j = jusqua(3);
  const e = etatCarnet(j);
  assert.equal(e.statut, 'termine');
  assert.equal(e.missionCourante, null);
  assert.deepEqual(e.missions.map((m) => m.statut), ['validee', 'validee', 'validee']);
  assert.deepEqual(e.budget, { confirme: 300000, reserve: 0, disponible: 700000 });
  assert.equal(j.length, 11);
  refus(j, ev('carnet-arrete', { motif: 'trop tard' }), /carnet terminé/);
});

test('carnet : journal append-only, rejeu déterministe et refus de corruption', () => {
  const j = jusqua(1);
  assert.ok(Object.isFrozen(j) && Object.isFrozen(j[0].donnees.missions[0]));
  const avant = canonique(j);
  const r = appliquerCarnet(j, ouverte(2));
  assert.equal(canonique(j), avant, 'le journal reçu est inchangé');
  assert.equal(r.length, j.length + 1);
  assert.equal(canonique(etatCarnet(j)), canonique(etatCarnet(structuredClone(j))));
  const trou = structuredClone(j); trou[2].n = 9;
  assert.equal(verifierCarnet(trou).ok, false);
  const premier = structuredClone(j); premier[0].type = 'carnet-approuve';
  assert.match(verifierCarnet(premier).raison, /premier événement/);
  assert.equal(verifierCarnet([]).ok, false);
  const extra = structuredClone(j); extra[1].autre = 1;
  assert.match(verifierCarnet(extra).raison, /mal formé/);
  refus(j, { type: 'mission-ouverte', donnees: {} }, /mal formé/);
});

test('carnet : forme durable canonique ASCII, relue, extension seulement', () => {
  const j = jusqua(1);
  const texte = canonique(etatDurableCarnet(j));
  const l = lireEtatCarnet(texte);
  assert.equal(l.raison, undefined);
  assert.equal(l.etat.statut, 'en-cours');
  assert.match(l.empreinte, /^[0-9a-f]{64}$/);
  assert.ok(/^[\x20-\x7e\n]*$/.test(texte), 'texte durable ASCII (accents échappés)');
  assert.match(lireEtatCarnet(texte.replace('\n', '\r\n')).raison, /ASCII|canonique/);
  assert.match(lireEtatCarnet(JSON.stringify(etatDurableCarnet(j))).raison, /non canonique/);
  assert.match(lireEtatCarnet(canonique({ ...etatDurableCarnet(j), protocole: 'x' })).raison, /protocole inconnu/);
  assert.match(lireEtatCarnet(canonique({ ...etatDurableCarnet(j), carnet: 'carnet-autre' })).raison, /identifiant du carnet différent/);
  assert.match(lireEtatCarnet('').raison, /absent/);
  const plus = suite(j, ouverte(2));
  assert.deepEqual(comparerCarnets(etatDurableCarnet(j), etatDurableCarnet(plus)), { statut: 'extension' });
  assert.deepEqual(comparerCarnets(etatDurableCarnet(j), etatDurableCarnet(j)), { statut: 'identique' });
  assert.match(comparerCarnets(etatDurableCarnet(plus), etatDurableCarnet(j)).raison, /non prolongé/);
  const autre = suite(jusqua(1), ev('carnet-arrete', { motif: 'x' }));
  assert.match(comparerCarnets(etatDurableCarnet(plus), etatDurableCarnet(autre)).raison, /non prolongé/);
});

test('carnet : bilan d\'un chantier de mission (candidat accepté, coût conservateur)', () => {
  assert.deepEqual(bilanChantier(chantierMission(1)), { statut: 'termine', candidat: sha('b'), cout: 100000, inconnu: false });
  assert.deepEqual(bilanChantier(chantierMission(1, { accepter: false })), { statut: 'en-cours', candidat: null, cout: 100000, inconnu: false });
  assert.deepEqual(bilanChantier(chantierMission(1, { payer: false })), { statut: 'termine', candidat: sha('b'), cout: null, inconnu: true });
  assert.equal(bilanChantier({ journal: chantierMission(1).journal, registre: null }).cout, null, 'sans registre : coût inconnu');
  const c = chantierMission(1, { payer: false });
  const regularise = appliquerBudget(c.registre, { type: 'cout', quand: Q, donnees: { execution: 'carnet-essai-m1-t1', montant: 101200, issue: 'issue-inconnue', regularisation: 'm' } });
  assert.equal(bilanChantier({ journal: c.journal, registre: regularise }).inconnu, true, 'régularisation d\'issue inconnue : coût non constaté');
  // Les exécutions d'un autre chantier du même registre ne comptent pas.
  const autre = appliquerBudget(appliquerBudget(appliquerBudget(chantierMission(1).registre, { type: 'chantier-plafonne', quand: Q, donnees: { chantier: 'x', plafond: 9 } }), { type: 'engagement', quand: Q, donnees: { execution: 'x1', chantier: 'x', maximum: 9 } }), { type: 'cout', quand: Q, donnees: { execution: 'x1', montant: 9 } });
  assert.equal(bilanChantier({ journal: chantierMission(1).journal, registre: autre }).cout, 100000);
});

// MISE À JOUR DÉLIBÉRÉE v0.65.19 (AT-10.2) : comparerChantier exige désormais la PRÉPARATION exacte de la mission (cycle, plafond,
// lancement AUTO, engagement, instantané) ; le chantier de référence est chantierPrepare (un chantier MANUEL non préparé diverge).
test('carnet : comparerChantier signale toute divergence entre le chantier et la mission', () => {
  const e = etatCarnet(suite(jusqua(0), ouverte(1)));
  assert.equal(comparerChantier(e, 1, chantierPrepare(1)), null);
  assert.match(comparerChantier(e, 2, chantierPrepare(2)), /non ouverte/);
  assert.match(comparerChantier(e, 1, chantierPrepare(1, { etape: 'prepare', change: { id: 'carnet-essai-m9' } })), /au lieu de/);
  assert.match(comparerChantier(e, 1, chantierPrepare(1, { etape: 'prepare', change: { objectif: 'Autre objectif.' } })), /objectif/);
  assert.match(comparerChantier(e, 1, chantierPrepare(1, { base: { sha: sha('f'), version: '0.65.17' } })), /base du chantier/);
  const m = mission(1);
  assert.match(comparerChantier(e, 1, chantierPrepare(1, { etape: 'prepare', change: { plan: [{ id: m.jalon.id, titre: m.jalon.titre, critere: m.jalon.critere, tentativesMax: 2 }] } })), /une tentative/);
  assert.match(comparerChantier(e, 1, chantierPrepare(1, { etape: 'prepare', change: { plan: [{ id: m.jalon.id, titre: 'Autre', critere: m.jalon.critere, tentativesMax: 1 }] } })), /jalon du chantier différent/);
  assert.match(comparerChantier(e, 1, chantierPrepare(1, { etape: 'prepare', change: { plan: [{ id: m.jalon.id, titre: m.jalon.titre, critere: m.jalon.critere, tentativesMax: 1 }, { id: 'b', titre: 'b', critere: 'b', tentativesMax: 1 }] } })), /exactement un jalon/);
  assert.match(comparerChantier(e, 1, chantierPrepare(1, { plafond: 150001, etape: 'prepare' })), /plafond AT-2 du chantier différent/);
  assert.match(comparerChantier(e, 1, chantierPrepare(1, { plafond: 149999 })), /plafond AT-2 du chantier différent/);
});

// ------------------------------------------------------------------------------------------------ v0.65.19 — AT-10.2
test('AT-10.2 preparationMission : chantier, plan, instantané, cycle, plafond et appel AUTO dérivés de la seule V1, gelés', () => {
  const e = etatCarnet(suite(jusqua(0), ouverte(1)));
  const p = preparationMission(e, 1);
  const m = mission(1);
  assert.equal(p.raison, undefined);
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p.chantier.plan[0]) && Object.isFrozen(p.mission.criteres) && Object.isFrozen(p.appel));
  const plan = [{ id: 'essai-1', titre: 'Essai 1', critere: 'Test essai-1 vert.', tentativesMax: 1 }];
  assert.deepEqual(JSON.parse(JSON.stringify(p)), {
    chantier: { id: 'carnet-essai-m1', objectif: m.objectif, base: { ...BASE }, plan }, plan,
    mission: JSON.parse(JSON.stringify(instantane(1))),
    cycle: { cycle: 'carnet-essai-m1', plafond: 150000, reserve: 0, plafondRun: 150000 }, plafond: 150000,
    appel: { ...APPEL }, developpement: { ...DEV }, engagement: 101200,
  });
  // DB : le plan est EXACTEMENT celui de la V1 (un jalon, une tentative) ; rien d'autre n'est ajouté.
  assert.deepEqual(Object.keys(p).sort(), ['appel', 'chantier', 'cycle', 'developpement', 'engagement', 'mission', 'plafond', 'plan']);
  assert.equal(canonique(p.chantier.plan), canonique(p.plan));
  // Une mission non ouverte (à venir, hors carnet, carnet seulement approuvé ou mission validée) ne se prépare pas.
  assert.match(preparationMission(e, 2).raison, /mission 2 non ouverte/);
  assert.match(preparationMission(e, 4).raison, /hors du carnet/);
  assert.match(preparationMission(etatCarnet(jusqua(0)), 1).raison, /non ouverte/);
  assert.match(preparationMission(etatCarnet(jusqua(1)), 1).raison, /non ouverte/);
  // Mission 2 ouverte après la livraison de la mission 1 : sa base est la livraison précédente.
  const e2 = etatCarnet(suite(jusqua(1), ouverte(2)));
  assert.deepEqual({ ...preparationMission(e2, 2).chantier.base }, baseDe(2));
  assert.equal(comparerChantier(e2, 2, chantierPrepare(2)), null);
});

test('AT-10.2 preparationMission : pure et déterministe (même carnet => même préparation), aucune écriture dans le carnet', () => {
  const j = suite(jusqua(0), ouverte(1));
  const avant = canonique(j);
  assert.equal(canonique(preparationMission(etatCarnet(j), 1)), canonique(preparationMission(etatCarnet(j), 1)));
  assert.equal(canonique(j), avant);
});

test('AT-10.2 comparerChantier : chaque étape préparée est conforme ; états incomplets refusés', () => {
  const e = etatCarnet(suite(jusqua(0), ouverte(1)));
  for (const etape of ['prepare', 'lance', 'rendu', 'accepte', 'refuse', 'inconnu']) assert.equal(comparerChantier(e, 1, chantierPrepare(1, { etape })), null, etape);
  const c = chantierPrepare(1);
  assert.match(comparerChantier(e, 1, { ...c, registre: null }), /préparation incomplète : registre AT-2 absent/);
  assert.match(comparerChantier(e, 1, { ...c, registre: [] }), /préparation incomplète : registre AT-2 absent/);
  assert.match(comparerChantier(e, 1, { ...c, registre: c.registre.slice(0, 1) }), /préparation incomplète : plafond AT-2 du chantier absent/);
  assert.match(comparerChantier(e, 1, { ...c, pieces: {} }), /préparation incomplète : instantané de la mission absent/);
  assert.match(comparerChantier(e, 1, { ...c, pieces: undefined }), /préparation incomplète : instantané de la mission absent/);
});

test('AT-10.2 comparerChantier : cycle, plafond, engagement, lancement ou instantané altérés => DIVERGENCE', () => {
  const e = etatCarnet(suite(jusqua(0), ouverte(1)));
  const cas = [
    [{ cycle: { cycle: '2026-10' } }, /cycle AT-2 différent/],
    [{ cycle: { plafond: 1000000 } }, /cycle AT-2 différent/],
    [{ cycle: { reserve: 1 } }, /cycle AT-2 différent/],
    [{ cycle: { plafondRun: 140000 } }, /cycle AT-2 différent/],
    [{ engagement: 120000 }, /engagement AT-2 différent/],
    [{ lancement: { appel: { ...APPEL, max_tokens: 2000 } } }, /lancement différent de l'appel approuvé/],
    [{ lancement: { developpement: { ...DEV, effort: 'high' } } }, /lancement différent de l'appel approuvé/],
    [{ piece: { criteres: ['Autre critère.'] } }, /instantané de la mission différent/],
    [{ piece: { decisions: [{ id: 'D-001', texte: 'Ajout.' }] } }, /instantané de la mission différent/],
    [{ piece: { autorises: ['app/atelier/essai-1.js'] } }, /instantané de la mission différent/],
  ];
  for (const [o, motif] of cas) assert.match(comparerChantier(e, 1, chantierPrepare(1, { etape: 'lance', ...o })), motif, JSON.stringify(o));
  // Deux cycles, deux plafonds ou un plafond pour un autre chantier : refusés.
  const c = chantierPrepare(1, { etape: 'prepare' });
  const plus = (ev) => ({ ...c, registre: [...c.registre, { ...ev, n: c.registre.length + 1 }] });
  assert.match(comparerChantier(e, 1, plus(c.registre[0])), /cycle AT-2 différent/);
  assert.match(comparerChantier(e, 1, plus(c.registre[1])), /plafond AT-2 du chantier différent/);
  const autre = { ...c, registre: [c.registre[0], { ...c.registre[1], donnees: { chantier: 'x', plafond: 150000 } }] };
  assert.match(comparerChantier(e, 1, autre), /plafond AT-2 du chantier différent/);
  // Lancement MANUEL (sans mode) : jamais pour une mission de carnet.
  const l = chantierPrepare(1, { etape: 'lance' });
  const manuel = { ...l, journal: l.journal.map((ev) => (ev.type === 'tentative-lancee' ? { ...ev, donnees: { jalon: 'essai-1' } } : ev)) };
  assert.match(comparerChantier(e, 1, manuel), /lancement différent de l'appel approuvé/);
});

test('carnet : pré-remplissage du formulaire de la mission ouverte seulement', () => {
  const e = etatCarnet(suite(jusqua(0), ouverte(1)));
  assert.deepEqual(formulaireMission(e, 1), { chantier: 'carnet-essai-m1', objectif: mission(1).objectif, version: '0.65.17', sha: BASE.sha, jalons: [{ id: 'essai-1', titre: 'Essai 1', critere: 'Test essai-1 vert.', tentativesMax: '1' }] });
  assert.equal(formulaireMission(e, 2), null);
  assert.equal(formulaireMission(etatCarnet(jusqua(0)), 1), null);
});

test('carnet : preuve de livraison ATELIER-LIVRAISON-1 (texte exact, relue, illisible refusée)', () => {
  const d = livraison(1);
  const t = texteLivraison(d);
  assert.equal(t, `ATELIER-LIVRAISON-1 carnet=carnet-essai mission=1 chantier=carnet-essai-m1 version=0.65.18 main=${sha('1')} candidat=${sha('b')} cout=100000 preuve=${'1'.repeat(64)}`);
  assert.deepEqual({ ...lireLivraison(t).livraison }, d);
  assert.deepEqual({ ...lireLivraison(`${t}\n`).livraison }, d);
  assert.match(lireLivraison(` ${t}`).raison, /illisible/);
  assert.match(lireLivraison(t.replace('mission=1', 'mission=4')).raison, /illisible/);
  assert.match(lireLivraison(t.replace('cout=100000', 'cout=1.5')).raison, /illisible/);
  assert.match(lireLivraison(null).raison, /absente/);
  assert.throws(() => texteLivraison({ ...d, main: 'x' }), TypeError);
});

test('carnet : pureté (ni horloge, ni hasard, ni réseau, ni stockage) et imports de l\'atelier seulement', () => {
  for (const motif of [/Date\b/, /Math\.random/, /\bfetch\b/, /localStorage/, /XMLHttpRequest/, /process\./, /require\(/]) assert.doesNotMatch(CODE, motif);
  const imports = [...SRC.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  // MISE À JOUR DÉLIBÉRÉE v0.65.20 (AT-10.3, L2) : parcours.js (proposerVersion, la règle de J4) rejoint les imports, tous de l'atelier.
  assert.deepEqual(imports, ['./mission.js', './auto.js', './parcours.js', './chantier.js', './budget.js', './journal.js', './empreinte.js']);
});

test('carnet : isolement — seuls l\'écran de l\'atelier et l\'outil auto-carnet l\'importent (hors tests) ; aucun import dynamique', () => {
  const importeurs = [];
  for (const f of fichiers(RACINE)) {
    const rel = relative(RACINE, f).split(sep).join('/');
    if (rel.startsWith('tests/')) continue;
    const c = readFileSync(f, 'utf8');
    if (/from\s*['"][^'"]*carnet\.js['"]/.test(c)) importeurs.push(rel);
    if (rel !== 'app/main.js') assert.doesNotMatch(c, /import\s*\([^)]*carnet/, rel);
  }
  assert.deepEqual(importeurs.sort(), ['app/atelier/ecran.js', 'outils-atelier/auto-carnet.mjs']);
  assert.doesNotMatch(readFileSync(join(RACINE, 'app', 'main.js'), 'utf8'), /carnet/);
});
