// v0.65.6 — AT-6 « MANUEL DE BOUT EN BOUT » (GO 17/10/2026 ; décision D-007 sur les autorisations manuelles). OUTILLAGE NON COGNITIF.
// L'écran de l'atelier sur un DOM factice et un stockage en mémoire : les quatre gestes (copier et lancer, enregistrer le candidat,
// confronter les faits, décider), la séparation FAITS -> VERDICT -> DÉCISION, le verdict RECALCULÉ (jamais relu), la sauvegarde AVANT
// le presse-papiers, le rechargement à chaque étape, la copie v1, la copie v2 sabotée (illisible), OFF sans aucun geste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLE_ATELIER } from '../app/atelier/ecran.js';
import { construireMission } from '../app/atelier/mission.js';
import { etatDe } from '../app/atelier/chantier.js';
import { lireFaits } from '../app/atelier/verification.js';
import { texteDemande } from '../app/atelier/parcours.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { BASE, CANDIDAT, FAITS, RAPPORT_POUR, FAITS_PREMIERE_RECETTE, monterEcran, stockageMemoire, confirmerSauvegarde } from './atelier-aide.mjs'; // MISE À JOUR DÉLIBÉRÉE v0.65.7 (+ confirmerSauvegarde, D3)

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(RACINE, 'app', 'atelier', 'ecran.js'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const VERSION = '0.65.5';
const K1 = 'temoin-1/1';

const monter = (o = {}) => monterEcran({ version: VERSION, ...o });
const journal = (a) => a.copie().journal;
const types = (a) => journal(a).map((e) => e.type);
const piece = (a, k = K1) => a.copie().pieces[k];
const demandeDe = (a, k = K1) => piece(a, k).demande;

// Étapes du parcours MANUEL, chacune par les VRAIS gestes de l'écran.
async function aLancer(o) {
  const a = monter(o);
  await a.cliquer('mode-manuel');
  await a.cliquer('temoin');
  a.saisir('sha', BASE);
  await a.cliquer('ouvrir');
  await a.cliquer('approuver');
  return a;
}
// MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3 « pas de candidat sans lancement sauvegardé ») : une tentative lancée n'est utilisable
// (dossier copiable, candidat enregistrable) qu'après la sauvegarde durable confirmée de son lancement : l'étape « lancée » l'inclut.
async function lancee(o) { const a = await aLancer(o); await a.cliquer('generer'); await a.cliquer('lancer'); await confirmerSauvegarde(a); return a; }
async function rendue(o) { const a = await lancee(o); a.saisir('rapport', RAPPORT_POUR(piece(a).mission)); await a.cliquer('enregistrer'); return a; }
async function demandee(o) { const a = await rendue(o); await a.cliquer('copier-demande'); return a; }
async function confrontee(issue = 'conforme', o) { const a = await demandee(o); a.saisir('faits-colles', FAITS({ demande: demandeDe(a), issue })); await a.cliquer('confronter'); return a; }

// ------------------------------------------------------------------------------------------------ parcours complet
test('parcours MANUEL complet conforme : lancer, enregistrer, demander, confronter, accepter, clôture — sans dépôt ni acquisition', async () => {
  const a = await aLancer();
  assert.match(a.etape(), /génère le dossier, puis « Copier et lancer la tentative »/);
  await a.cliquer('generer');
  const m = a.copie().mission;
  assert.equal(m.tentative, 1);
  assert.deepEqual(types(a), ['ouvert', 'plan-approuve']); // générer ne lance rien
  await a.cliquer('lancer');
  assert.deepEqual(types(a), ['ouvert', 'plan-approuve', 'tentative-lancee']);
  assert.deepEqual(journal(a)[2].donnees, { jalon: 'temoin-1' });
  assert.deepEqual(piece(a), { mission: m, rapport: null, demande: null, faits: [] });
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3) : lancer ne copie plus rien ; le dossier n'est copiable qu'après la sauvegarde durable
  // confirmée de ce lancement (geste séparé « Copier le dossier »).
  assert.deepEqual(a.copies, []);
  assert.match(a.etape(), /Sauvegarde durable requise \(D3\)/);
  await confirmerSauvegarde(a);
  await a.cliquer('recopier-dossier');
  assert.deepEqual(a.copies, [construireMission(m)]);
  assert.match(a.un('portee-dossier').textContent, /autorise UNIQUEMENT la création et le push de la branche atelier\/temoin-atelier\/temoin-1\/1/);
  assert.match(a.etape(), /Colle le dossier à Claude/);

  const rapport = RAPPORT_POUR(m);
  a.saisir('rapport', rapport);
  await a.cliquer('enregistrer');
  assert.equal(types(a)[3], 'tentative-rendue');
  assert.deepEqual(journal(a)[3].donnees, { jalon: 'temoin-1', numero: 1, reference: `atelier/temoin-atelier/temoin-1/1@${CANDIDAT}` });
  assert.equal(piece(a).rapport, rapport);
  assert.deepEqual(a.sectionOuverte(), ['verification']);

  assert.equal(a.un('version-candidat').value, '0.65.6');
  await a.cliquer('copier-demande');
  const d = { branche: 'atelier/temoin-atelier/temoin-1/1', candidat: CANDIDAT, base: BASE, version_base: VERSION, version_candidat: '0.65.6' };
  assert.deepEqual(demandeDe(a), d);
  assert.equal(a.copies.at(-1), texteDemande(d));
  assert.match(a.un('portee-demande').textContent, /autorise UNIQUEMENT le run AT-5/);

  const faits = FAITS({ demande: d });
  a.saisir('faits-colles', faits);
  const avant = journal(a);
  await a.cliquer('confronter');
  assert.deepEqual(piece(a).faits, [faits]);
  assert.deepEqual(journal(a), avant); // un verdict conforme ne déclenche RIEN
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-conforme');
  const t = a.texte();
  assert.ok(t.indexOf('Faits techniques du dernier run') < t.indexOf('Verdict technique — ce n\'est pas une acceptation.'));
  assert.ok(t.indexOf('Verdict technique — ce n\'est pas une acceptation.') < t.indexOf('DÉCISION HUMAINE'));
  assert.match(a.etape(), /il n'y a aucune acceptation automatique/);

  await a.cliquer('accepter'); // sans motif
  assert.deepEqual(journal(a), avant);
  assert.match(a.texte(), /Décision impossible : motif humain obligatoire/);
  a.saisir('motif-decision', 'Témoin vérifié, accepté.');
  await a.cliquer('accepter');
  const dec = journal(a).at(-1);
  assert.equal(dec.type, 'tentative-acceptee');
  assert.deepEqual(dec.donnees, { jalon: 'temoin-1', numero: 1, motif: 'Témoin vérifié, accepté.', candidat: CANDIDAT, faits: lireFaits(faits, hacherSha256).faits.empreinte, verdict: 'verification-technique-conforme', run_id: '41000000001' });
  assert.equal(etatDe(journal(a)).statut, 'termine');
  assert.match(a.un('chantier-termine').textContent, /Ni dépôt sur main, ni acquisition/);
  assert.match(a.un('accepte-temoin-1').textContent, new RegExp(`candidat accepté : atelier/temoin-atelier/temoin-1/1@${CANDIDAT}`));
  assert.match(a.texte(), /Ce n'est ni un dépôt, ni une acquisition ; main est inchangé/);
  // Le verdict n'est jamais stocké dans les pièces : seule la décision humaine le CITE.
  assert.equal(JSON.stringify(a.copie().pieces).includes('verification-technique'), false);
});
test('rechargement à chaque étape : étape et verdict recalculés depuis le journal et les pièces, aucune écriture, rien d\'inventé', async () => {
  for (const [nom, etape] of [[aLancer, /génère le dossier/], [lancee, /Colle le dossier à Claude/], [rendue, /Copie la demande de vérification/], [demandee, /Ouvre le run, copie les faits/], [confrontee, /aucune acceptation automatique/]]) {
    const a = await nom();
    const brut = a.stockage.getItem(CLE_ATELIER);
    const b = monter({ stockage: stockageMemoire(brut) });
    assert.match(b.etape(), etape, nom.name);
    assert.equal(b.stockage.ecritures, 0, nom.name);
    assert.equal(b.stockage.getItem(CLE_ATELIER), brut);
    if (nom === confrontee) assert.equal(b.un('verdict-technique').textContent, 'Verdict : verification-technique-conforme');
  }
  const a = await rendue();
  const b = monter({ stockage: stockageMemoire(a.stockage.getItem(CLE_ATELIER)) });
  assert.deepEqual(b.sectionOuverte(), ['verification']);
});

// ------------------------------------------------------------------------------------------------ geste 1 : lancer
test('lancement ≠ génération : « Copier » (AT-4) ne lance rien ; lancer exige le dossier généré de CETTE tentative', async () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3) : le bouton « Copier » d'avant lancement n'existe plus (le dossier ne se copie qu'après le
  // lancement et sa sauvegarde durable) ; générer montre l'aperçu et ne lance toujours rien.
  const a = await aLancer();
  assert.equal(a.trouver('lancer').length, 0);
  await a.cliquer('generer');
  assert.equal(a.trouver('copier').length, 0);
  assert.match(a.un('apercu-d3').textContent, /Il ne se copie qu'après son lancement ET la sauvegarde durable confirmée de ce lancement \(D3\)/);
  assert.deepEqual(a.copies, []);
  assert.deepEqual(types(a), ['ouvert', 'plan-approuve']);
  assert.deepEqual(a.copie().pieces, {});
  assert.equal(a.trouver('lancer').length, 1);
});
test('lancer fige l\'instantané GÉNÉRÉ (celui affiché), jamais la fiche modifiée entre-temps', async () => {
  const a = await aLancer();
  await a.cliquer('generer');
  const m = a.copie().mission;
  a.saisir('comportement', 'Fiche modifiée après la génération.');
  await a.cliquer('lancer');
  assert.deepEqual(piece(a).mission, m);
  await confirmerSauvegarde(a); // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3) : copie du dossier après la sauvegarde confirmée
  await a.cliquer('recopier-dossier');
  assert.equal(a.copies.at(-1), construireMission(m));
  assert.notEqual(a.copie().fiches['temoin-1'].comportement, m.jalon.comportement);
});
test('lancer : sauvegarde AVANT le presse-papiers ; presse-papiers en échec => tentative lancée, « Recopier le dossier » disponible', async () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3) : lancer ne touche plus du tout au presse-papiers ; la première copie du dossier vient
  // après la sauvegarde durable confirmée, et elle aussi relit une copie locale déjà enregistrée.
  let vu = null;
  const s = stockageMemoire();
  let echec = true;
  const a = await aLancer({ stockage: s, copier: async () => { vu = JSON.parse(s.getItem(CLE_ATELIER)); if (echec) throw new Error('refus du presse-papiers'); } });
  await a.cliquer('generer');
  await a.cliquer('lancer');
  assert.equal(vu, null);
  assert.equal(a.copie().journal.at(-1).type, 'tentative-lancee');
  assert.ok(a.copie().pieces[K1]);
  await confirmerSauvegarde(a);
  await a.cliquer('recopier-dossier');
  assert.equal(vu.journal.at(-1).type, 'tentative-lancee');
  assert.ok(vu.sauvegarde);
  assert.match(a.un('retour-dossier').textContent, /Copie impossible : refus du presse-papiers — utilise « Recopier »/);
  echec = false;
  await a.cliquer('recopier-dossier');
  assert.equal(a.copies.at(-1), construireMission(piece(a).mission));
  assert.match(a.un('retour-dossier').textContent, /^Dossier copié ✓/);
  assert.deepEqual(types(a), ['ouvert', 'plan-approuve', 'tentative-lancee']);
});
test('lancer : enregistrement impossible => rien n\'est lancé, rien n\'est copié', async () => {
  const a = await aLancer();
  await a.cliquer('generer');
  const n = a.copies.length;
  a.stockage.panne = true;
  await a.cliquer('lancer');
  a.stockage.panne = false;
  assert.deepEqual(types(a), ['ouvert', 'plan-approuve']);
  assert.equal(a.copies.length, n);
  assert.match(a.texte(), /Lancement impossible : Copie locale non enregistrée/);
  assert.match(a.etape(), /génère le dossier/);
});
test('mission figée : pendant la tentative, fiche verrouillée et Générer refusé ; le dossier reste l\'instantané lancé', async () => {
  const a = await lancee();
  const m = piece(a).mission;
  assert.equal(a.un('comportement').disabled, true);
  assert.equal(a.un('fiche-figee').tag, 'p');
  a.saisir('comportement', 'modifié après lancement');
  assert.equal(a.copie().fiches['temoin-1'].comportement, m.jalon.comportement);
  await a.cliquer('generer');
  assert.match(a.texte(), /Dossier impossible : aucune nouvelle tentative à cette étape/);
  assert.deepEqual(piece(a).mission, m);
  assert.equal(a.un('dossier').value, construireMission(m));
});

// ------------------------------------------------------------------------------------------------ geste 2 : enregistrer
test('rapport invalide : non enregistré, aucune écriture ; rapport bloque / echec : aucun candidat rendu, annulation avec motif', async () => {
  const a = await lancee();
  const e = a.stockage.ecritures;
  for (const r of ['', '{', RAPPORT_POUR(piece(a).mission, { tentative: 2 }), RAPPORT_POUR(piece(a).mission, { candidat: { branche: 'atelier/temoin-atelier/temoin-1/2', sha: CANDIDAT } })]) {
    a.saisir('rapport', r);
    await a.cliquer('enregistrer');
    assert.match(a.texte(), /Enregistrement impossible : rapport non conforme/);
  }
  const bloque = RAPPORT_POUR(piece(a).mission, { statut: 'bloque', candidat: null, fichiers: { crees: [], modifies: [], supprimes: [] }, tests: null, question: 'Quel fichier ?' });
  a.saisir('rapport', bloque);
  await a.cliquer('enregistrer');
  assert.match(a.texte(), /Claude annonce « bloque » : aucun candidat n'est rendu/);
  assert.equal(a.stockage.ecritures, e);
  assert.deepEqual(types(a), ['ouvert', 'plan-approuve', 'tentative-lancee']);
  await a.cliquer('annuler');
  assert.match(a.texte(), /Annulation impossible : motif humain obligatoire/);
  a.saisir('motif-decision', 'Claude bloqué : question à trancher.');
  await a.cliquer('annuler');
  assert.equal(journal(a).at(-1).type, 'tentative-annulee');
  assert.match(a.etape(), /génère le dossier/);
  assert.equal(piece(a).rapport, null); // le rapport bloqué n'est jamais conservé comme candidat
});

// ------------------------------------------------------------------------------------------------ demande de vérification
test('demande : version_candidat proposée, modifiable avant copie, figée ensuite ; invalide (≤ version_base) refusée', async () => {
  const a = await rendue();
  a.saisir('version-candidat', '0.65.5');
  await a.cliquer('copier-demande');
  assert.match(a.texte(), /Demande impossible : demande.version_candidat : doit être plus grande que version_base/);
  assert.equal(demandeDe(a), null);
  a.saisir('version-candidat', '0.66.0');
  await a.cliquer('copier-demande');
  assert.equal(demandeDe(a).version_candidat, '0.66.0');
  assert.equal(a.trouver('version-candidat').length, 0);
  assert.match(a.un('demande-version_candidat').textContent, /0\.66\.0 \(valeur d'essai figée dans la demande\)/);
  const e = a.stockage.ecritures;
  await a.cliquer('copier-demande');
  assert.equal(a.copies.at(-1), a.copies.at(-2));
  assert.equal(a.stockage.ecritures, e); // recopier n'écrit rien : la demande est déjà figée
});

// ------------------------------------------------------------------------------------------------ geste 3 : confronter
test('faits absents, corrompus, périmés, d\'une autre demande, ou le rapport collé comme faits : rien n\'est conservé', async () => {
  const a = await demandee();
  const d = demandeDe(a);
  const e = a.stockage.ecritures;
  const bon = FAITS({ demande: d });
  const illisibles = /Confrontation impossible : faits illisibles : /;
  for (const [t, m0] of [['', /faits vides/], [bon.slice(0, 200), /JSON illisible/], [bon.replace('"reussis": 5395', '"reussis": 5394'), /empreinte/],
    [FAITS_PREMIERE_RECETTE, /atelier-faits-1 périmé/], [FAITS({ demande: { ...d, version_candidat: '0.65.7' } }), /Confrontation impossible : faits d'une autre demande que celle copiée/], [piece(a).rapport, illisibles]]) {
    const motif = (m0 !== illisibles && !/autre demande/.test(String(m0))) ? new RegExp(illisibles.source + '.*' + m0.source) : m0;
    a.saisir('faits-colles', t);
    await a.cliquer('confronter');
    assert.match(a.texte(), motif);
    assert.deepEqual(piece(a).faits, []);
  }
  assert.equal(a.stockage.ecritures, e);
});
test('faits append-only : un second run de la même demande s\'ajoute ; le verdict est celui du dernier', async () => {
  const a = await confrontee('impossible');
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-impossible');
  a.saisir('faits-colles', FAITS({ demande: demandeDe(a), run: '41000000002' }));
  await a.cliquer('confronter');
  assert.equal(piece(a).faits.length, 2);
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-conforme');
  assert.match(a.un('faits-recus-0').textContent, /run 41000000001/);
  assert.match(a.un('faits-recus-1').textContent, /run 41000000002/);
});

test('geste hors étape : un bouton périmé (étape dépassée) est refusé par le parcours, avant toute autre garde', async () => {
  const a = await lancee();
  a.saisir('rapport', RAPPORT_POUR(piece(a).mission));
  const perime = a.un('enregistrer');
  await a.cliquer('enregistrer');
  const avant = a.stockage.getItem(CLE_ATELIER);
  for (const f of perime.listeners.click) await f();
  assert.match(a.texte(), /Enregistrement impossible : Geste impossible à l'étape « demande-a-copier »/);
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant);
  const b = await confrontee('conforme');
  const accepter = b.un('accepter');
  b.saisir('faits-colles', FAITS({ demande: demandeDe(b), issue: 'impossible', run: '41000000003' }));
  await b.cliquer('confronter');
  b.saisir('motif-decision', 'tentative périmée');
  const avantB = b.stockage.getItem(CLE_ATELIER);
  for (const f of accepter.listeners.click) await f();
  assert.match(b.texte(), /Décision impossible : Geste impossible à l'étape « verification-a-refaire »/);
  assert.equal(b.stockage.getItem(CLE_ATELIER), avantB);
});

// ------------------------------------------------------------------------------------------------ geste 4 : décision
test('non conforme : Accepter absent, Refuser possible (motif) => tentative 2', async () => {
  const a = await confrontee('non-conforme');
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-non-conforme');
  assert.equal(a.trouver('accepter').length, 0);
  assert.ok(a.trouver('raisons-non-conformite').length === 1);
  a.saisir('motif-decision', 'Tests en échec.');
  await a.cliquer('refuser');
  const dec = journal(a).at(-1);
  assert.equal(dec.type, 'tentative-rejetee');
  assert.equal(dec.donnees.verdict, 'verification-technique-non-conforme');
  assert.match(a.etape(), /génère le dossier/);
  await a.cliquer('generer');
  assert.equal(a.copie().mission.tentative, 2);
  await a.cliquer('lancer');
  assert.ok(piece(a, 'temoin-1/2'));
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7, D3) : la sauvegarde confirmée de la tentative 1 ne suffit pas pour la tentative 2.
  assert.equal(a.trouver('portee-dossier').length, 0);
  assert.equal(a.trouver('d3-attente').length, 1);
  await confirmerSauvegarde(a, 'f'.repeat(40));
  assert.match(a.un('portee-dossier').textContent, /atelier\/temoin-atelier\/temoin-1\/2/);
});
test('refus humain d\'un candidat conforme : possible, motif obligatoire', async () => {
  const a = await confrontee('conforme');
  a.saisir('motif-decision', 'Je préfère une autre approche.');
  await a.cliquer('refuser');
  assert.equal(journal(a).at(-1).type, 'tentative-rejetee');
  assert.equal(journal(a).at(-1).donnees.verdict, 'verification-technique-conforme');
});
test('vérification impossible : ni Accepter ni Refuser ; nouvelle vérification ou annulation', async () => {
  const a = await confrontee('impossible');
  assert.equal(a.trouver('accepter').length, 0);
  assert.equal(a.trouver('refuser').length, 0);
  assert.match(a.un('decision-impossible').textContent, /aucune acceptation ni aucun refus/);
  assert.equal(a.trouver('raisons-impossibilite').length, 1);
  a.saisir('motif-decision', 'Run en panne, on recommence.');
  await a.cliquer('annuler');
  assert.equal(journal(a).at(-1).type, 'tentative-annulee');
});
test('Accepter n\'est jamais atteignable sans verdict conforme recalculé (même bouton forcé)', async () => {
  const a = await confrontee('non-conforme');
  // Le bouton n'existe pas ; on rend la copie « conforme » en trichant sur un texte de faits : elle devient ILLISIBLE, pas acceptable.
  const c = a.copie();
  c.pieces[K1].faits[0] = c.pieces[K1].faits[0].replace('"statut": "echec"', '"statut": "executes"');
  const b = monter({ stockage: stockageMemoire(JSON.stringify(c)) });
  assert.match(b.un('illisible').textContent, /faits illisibles/);
  assert.equal(b.trouver('accepter').length, 0);
});

// ------------------------------------------------------------------------------------------------ copie v1, copie v2 sabotée, OFF
test('copie v1 (AT-4) : lue comme un chantier sans pièces ; aucune pièce historique inventée', async () => {
  const a = await aLancer();
  const v1 = { ...a.copie(), version: 1 };
  delete v1.pieces; delete v1.piecesDepuis;
  const b = monter({ stockage: stockageMemoire(JSON.stringify(v1)) });
  assert.match(b.etape(), /génère le dossier/);
  assert.equal(b.stockage.ecritures, 0);
  await b.cliquer('generer');
  await b.cliquer('lancer');
  assert.equal(b.copie().version, 3); // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7 : la copie écrite est en version 3)
  assert.equal(b.copie().piecesDepuis, 3);
  assert.ok(b.copie().pieces[K1]);
  // v1 dont le journal contient déjà une tentative lancée : aucune pièce inventée, seuls annuler / arrêter.
  const c = await lancee();
  const v1t = { ...c.copie(), version: 1 };
  delete v1t.pieces; delete v1t.piecesDepuis;
  const d = monter({ stockage: stockageMemoire(JSON.stringify(v1t)) });
  assert.match(d.etape(), /Tentative lancée avant AT-6 : ses pièces n'existent pas et ne sont pas inventées/);
  assert.equal(d.trouver('enregistrer').length, 0);
  assert.equal(d.trouver('annuler').length, 1);
});
test('copie v2 sabotée : illisible, rien n\'est utilisé ni réparé ni réécrit', async () => {
  const a = await confrontee('conforme');
  a.saisir('motif-decision', 'ok');
  await a.cliquer('accepter');
  const bonne = a.copie();
  const casse = (f) => { const c = structuredClone(bonne); f(c); return JSON.stringify(c); };
  const cas = [
    casse((c) => { delete c.pieces[K1]; }),
    casse((c) => { c.pieces['temoin-1/2'] = c.pieces[K1]; }),
    casse((c) => { c.pieces[K1].verdict = 'verification-technique-conforme'; }),
    casse((c) => { c.pieces[K1].faits = []; }),
    casse((c) => { c.pieces[K1].faits[0] = c.pieces[K1].faits[0].replace('41000000001', '41000000009'); }),
    casse((c) => { c.pieces[K1].rapport = c.pieces[K1].rapport.replace('c'.repeat(40), 'e'.repeat(40)); }),
    casse((c) => { c.pieces[K1].demande.version_candidat = '0.65.9'; }),
    casse((c) => { c.pieces[K1].mission.tentative = 2; }),
    casse((c) => { c.journal.at(-1).donnees.faits = '0'.repeat(64); }),
    casse((c) => { c.piecesDepuis = 'x'; }),
  ];
  for (const brut of cas) {
    const s = stockageMemoire(brut);
    const b = monter({ stockage: s });
    assert.match(b.un('illisible').textContent, /^Copie locale illisible : rien n'est utilisé \(/, brut.slice(0, 60));
    assert.equal(s.ecritures, 0);
    assert.equal(s.getItem(CLE_ATELIER), brut);
  }
});
test('OFF : consultation du parcours, aucun geste (même forcé) ; textes de saisie désactivés', async () => {
  const a = await confrontee('conforme');
  await a.cliquer('mode-off');
  const avant = a.stockage.getItem(CLE_ATELIER);
  const n = a.copies.length;
  a.saisir('motif-decision', 'forcé en OFF');
  for (const nom of ['copier-demande', 'confronter', 'accepter', 'refuser']) { const b = a.un(nom); assert.equal(b.disabled, true, nom); b.disabled = false; for (const f of b.listeners.click) await f(); }
  assert.equal(a.un('motif-decision').disabled, true);
  assert.equal(a.un('faits-colles').disabled, true);
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant);
  assert.equal(a.copies.length, n);
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-conforme');
});
test('code : le verdict n\'est lu que depuis confronter() ; aucune écriture de verdict dans les pièces ; un seul setItem', () => {
  assert.equal((CODE.match(/confronter\(\{/g) || []).length, 1);
  assert.doesNotMatch(CODE, /pieces\[[^\]]*\]\.verdict|\.verdict\s*=/);
  assert.equal((CODE.match(/stockage\.setItem\(/g) || []).length, 2); // MISE À JOUR DÉLIBÉRÉE v0.65.18 (AT-10.1) : + copie locale séparée du carnet (CLE_CARNET)
  for (const m of [/\bfetch\b/, /XMLHttpRequest/, /https?:/, /anthropic/i, /github\.com/i]) assert.equal(m.test(CODE), false, String(m)); // MISE À JOUR DÉLIBÉRÉE v0.65.9 (AT-8.1) : AUTO à blanc existe, sans réseau
});
