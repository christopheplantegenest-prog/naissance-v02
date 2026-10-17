// v0.65.7 — AT-7 « JOURNAL GIT + REPRISE » (GO 17/10/2026 ; D-007 précision D4). OUTILLAGE NON COGNITIF.
// L'écran de l'atelier (DOM factice, stockage en mémoire) : sauvegarde en parties k/N copiées une à une, confirmation de Claude retenue
// seulement pour l'état ACTUEL, D3 « pas de candidat sans lancement sauvegardé », restauration sur atelier VIDE seulement (parties dans
// n'importe quel ordre, aperçu, confirmation humaine, mode OFF, verdict recalculé, rien d'inventé), copie locale version 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLE_ATELIER } from '../app/atelier/ecran.js';
import { ecrireEtatDurable, decouper, texteConfirmation, assemblerParties } from '../app/atelier/journal.js';
import { construireMission } from '../app/atelier/mission.js';
import { conduire, confirmerSauvegarde, monterEcran, stockageMemoire, FAITS, RAPPORT_POUR } from './atelier-aide.mjs';

const VERSION = '0.65.5';
const K1 = 'temoin-1/1';
const CH = 'temoin-atelier';
const durable = (a) => ecrireEtatDurable(a.copie());
const confirmation = (a, commit = 'e'.repeat(40), patch = {}) => texteConfirmation({ chantier: CH, empreinte: durable(a).empreinte, commit, ...patch });
// Restaure des parties dans un écran neuf (atelier vide, MANUEL), sans confirmer.
async function vide() { const b = monterEcran({ version: VERSION }); await b.cliquer('mode-manuel'); return b; }
async function coller(b, parties) { for (const p of parties) { b.saisir('partie-restauration', p); await b.cliquer('ajouter-partie'); } }
// Atelier dont l'état durable dépasse une partie (six runs « impossible » collés par le vrai geste confronter), construit UNE fois pour
// la sauvegarde et la restauration ; l'instantané (copie, état durable) est relevé avant que le test de sauvegarde ne poursuive le chantier.
let grandMemo = null;
async function grand() {
  if (!grandMemo) {
    const a = await conduire('faits', { issue: 'impossible' });
    for (let i = 2; i <= 6; i += 1) { a.saisir('faits-colles', FAITS({ demande: a.copie().pieces[K1].demande, issue: 'impossible', run: `4100000000${i}` })); await a.cliquer('confronter'); }
    grandMemo = { a, copie: a.copie(), d: durable(a) };
  }
  return grandMemo;
}

// ------------------------------------------------------------------------------------------------ sauvegarde
test('sauvegarde : parties k/N copiées une à une, identiques au découpage de l\'état durable ; portée exacte ; préparation périmée', async () => {
  const { a } = await grand();
  const e = a.stockage.ecritures;
  await a.cliquer('preparer-sauvegarde');
  assert.equal(a.stockage.ecritures, e); // préparer n'écrit rien
  const attendues = decouper(durable(a).texte, CH);
  assert.ok(attendues.length >= 2, String(attendues.length));
  assert.match(a.un('sauvegarde-parties').textContent, new RegExp(`empreinte ${durable(a).empreinte}, ${attendues.length} partie\\(s\\)`));
  const n = a.copies.length;
  for (let k = attendues.length; k >= 1; k -= 1) await a.cliquer(`copier-partie-${k}`);
  assert.deepEqual(a.copies.slice(n), [...attendues].reverse());
  assert.match(a.un('retour-sauvegarde').textContent, /^Partie 1\/\d+ copié ✓/);
  assert.equal(assemblerParties(a.copies.slice(n)).contenu, durable(a).texte);
  assert.match(a.un('portee-sauvegarde').textContent, /autorise UNIQUEMENT : la branche journal-atelier\/temoin-atelier \(créée orpheline si absente, sinon avancée en avance rapide\), le seul fichier chantier\.json/);
  assert.match(a.un('portee-sauvegarde').textContent, /Aucun force-push, aucune suppression, aucune fusion, rien sur main, aucun tag, aucune branche candidate, aucun autre fichier\./);
  assert.equal(a.stockage.ecritures, e); // copier les parties n'écrit rien
  // Tout geste qui change l'état périme la préparation : plus aucune partie n'est copiable.
  a.saisir('motif-decision', 'Run en panne.');
  await a.cliquer('annuler');
  assert.equal(a.trouver('copier-partie-1').length, 0);
  assert.equal(a.trouver('preparation-perimee').length, 1);
});
test('confirmation : retenue seulement pour l\'état ACTUEL de ce chantier ; sinon refus, rien n\'est écrit ; statut à jour / modifié', async () => {
  const a = await conduire('en-cours');
  assert.match(a.un('sauvegarde-statut').textContent, /Aucune sauvegarde durable confirmée sur cet appareil/);
  const bonne = confirmation(a);
  const e = a.stockage.ecritures;
  for (const [texte, motif] of [
    ['', /confirmation illisible/],
    [bonne.replace('ATELIER-SAUVEGARDE-1', 'ATELIER-SAUVEGARDE-2'), /confirmation illisible/],
    [confirmation(a, 'e'.repeat(40), { chantier: 'autre-chantier' }), /confirmation du chantier « autre-chantier », pas de « temoin-atelier »/],
    [confirmation(a, 'e'.repeat(40), { empreinte: '0'.repeat(64) }), /confirmation d'un autre état que l'état actuel de cet appareil/],
  ]) {
    a.saisir('confirmation-sauvegarde', texte);
    await a.cliquer('enregistrer-confirmation');
    assert.match(a.texte(), motif);
    assert.match(a.texte(), /Confirmation refusée/);
  }
  assert.equal(a.stockage.ecritures, e);
  assert.equal(a.copie().sauvegarde, null);
  a.saisir('confirmation-sauvegarde', `${bonne}\n`);
  await a.cliquer('enregistrer-confirmation');
  assert.deepEqual(a.copie().sauvegarde, { empreinte: durable(a).empreinte, commit: 'e'.repeat(40), evenements: 2 });
  assert.equal(a.copie().version, 3);
  assert.match(a.un('sauvegarde-statut').textContent, new RegExp(`journal-atelier/temoin-atelier @ ${'e'.repeat(40)} — empreinte ${durable(a).empreinte.slice(0, 16)}… — à jour`));
  await a.cliquer('generer');
  await a.cliquer('lancer');
  assert.match(a.un('sauvegarde-statut').textContent, /état modifié depuis : sauvegarde à refaire/);
  // Une confirmation périmée (celle d'avant le lancement) est refusée.
  a.saisir('confirmation-sauvegarde', bonne);
  await a.cliquer('enregistrer-confirmation');
  assert.match(a.texte(), /confirmation d'un autre état que l'état actuel/);
  assert.equal(a.copie().sauvegarde.evenements, 2);
});

// ------------------------------------------------------------------------------------------------ D3
test('D3 : avant la sauvegarde confirmée du lancement, ni dossier copiable ni candidat enregistrable ; après, les deux', async () => {
  const a = await conduire('lancee');
  assert.match(a.un('prochaine-etape').textContent, /Sauvegarde durable requise \(D3\)/);
  assert.match(a.un('d3-attente').textContent, /Le dossier n'est pas copiable et aucun candidat ne peut être enregistré/);
  assert.match(a.un('dossier-d3').textContent, /il n'est copiable qu'après la sauvegarde durable confirmée de ce lancement/);
  for (const n of ['recopier-dossier', 'dossier', 'portee-dossier']) assert.equal(a.trouver(n).length, 0, n);
  assert.deepEqual(a.copies, []);
  assert.deepEqual(a.sectionOuverte(), ['sauvegarde']);
  const m = a.copie().pieces[K1].mission;
  a.saisir('rapport', RAPPORT_POUR(m));
  const avant = a.stockage.getItem(CLE_ATELIER);
  await a.cliquer('enregistrer');
  assert.match(a.texte(), /Enregistrement impossible : aucune sauvegarde durable confirmée de ce lancement \(D3\) : aucun candidat ne peut exister/);
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant);
  await confirmerSauvegarde(a);
  assert.equal(a.trouver('d3-attente').length, 0);
  assert.match(a.un('prochaine-etape').textContent, /Colle le dossier à Claude/);
  await a.cliquer('recopier-dossier');
  assert.deepEqual(a.copies, [construireMission(m)]);
  a.saisir('rapport', RAPPORT_POUR(m));
  await a.cliquer('enregistrer');
  assert.equal(a.copie().journal.at(-1).type, 'tentative-rendue');
});
test('D3 : une sauvegarde ANCIENNE ne suffit pas — ni celle d\'avant le lancement, ni celle de la tentative précédente', async () => {
  const a = await conduire('en-cours');
  await confirmerSauvegarde(a); // sauvegarde d'avant le lancement
  await a.cliquer('generer');
  await a.cliquer('lancer');
  assert.equal(a.trouver('d3-attente').length, 1);
  assert.equal(a.trouver('recopier-dossier').length, 0);
  const b = await conduire('decide', { issue: 'non-conforme' }); // tentative 1 sauvegardée puis refusée
  await b.cliquer('generer');
  await b.cliquer('lancer');
  assert.equal(b.trouver('d3-attente').length, 1);
  b.saisir('rapport', RAPPORT_POUR(b.copie().pieces['temoin-1/2'].mission));
  await b.cliquer('enregistrer');
  assert.match(b.texte(), /aucune sauvegarde durable confirmée de ce lancement \(D3\)/);
  await confirmerSauvegarde(b, 'f'.repeat(40));
  assert.equal(b.trouver('recopier-dossier').length, 1);
});

// ------------------------------------------------------------------------------------------------ restauration
test('restauration : atelier vide, parties dans n\'importe quel ordre, état partiel affiché, aperçu, AUCUNE installation avant confirmation', async () => {
  const { copie: avant, d } = await grand();
  const p = decouper(d.texte, CH);
  assert.ok(p.length >= 2);
  const b = await vide();
  const brut = b.stockage.getItem(CLE_ATELIER);
  const e = b.stockage.ecritures;
  await coller(b, [p[1]]);
  assert.match(b.un('restauration-etat').textContent, new RegExp(`Chantier temoin-atelier — empreinte attendue ${d.empreinte} — parties reçues : 2 sur ${p.length} — manquantes : 1`));
  // Une partie refusée (autre sauvegarde, tronquée, illisible) n'est pas conservée ; un doublon identique est ignoré.
  for (const [x, motif] of [[decouper(`${d.texte} `, CH)[0], /empreinte complète différent|chantier|nombre de parties différent|total_octets différent/], [p[0].slice(0, -5), /fin de partie absente/], ['bonjour', /début de partie absent/]]) {
    b.saisir('partie-restauration', x);
    await b.cliquer('ajouter-partie');
    assert.match(b.texte(), /Partie refusée : /);
    assert.match(b.texte(), motif);
  }
  await coller(b, [p[1]]);
  assert.match(b.texte(), /doublon identique ignoré/);
  await coller(b, [...p.slice(2), p[0]].reverse());
  assert.match(b.un('restauration-etat').textContent, new RegExp(`${p.length} partie\\(s\\) sur ${p.length} : assemblage et lecture complète réussis`));
  const apercu = b.un('apercu-restauration').children.map((x) => x.textContent).join('\n');
  assert.match(apercu, /APERÇU — rien n'est installé avant ta confirmation/);
  assert.match(apercu, /Chantier : temoin-atelier — statut technique : en-cours/);
  assert.match(apercu, /Étape retrouvée : verification-a-refaire/);
  assert.match(apercu, /Tentative temoin-1\/1 — rendue — atelier\/temoin-atelier\/temoin-1\/1@c{40} — verdict recalculé : verification-impossible/);
  assert.match(apercu, /Après confirmation : mode OFF/);
  // Rien n'est installé tant que la restauration n'est pas confirmée.
  assert.equal(b.stockage.getItem(CLE_ATELIER), brut);
  assert.equal(b.stockage.ecritures, e);
  await b.cliquer('confirmer-restauration');
  const c = b.copie();
  assert.equal(c.mode, 'OFF');
  assert.deepEqual([c.journal, c.registre, c.pieces, c.piecesDepuis], [avant.journal, avant.registre, avant.pieces, avant.piecesDepuis]);
  assert.deepEqual([c.version, c.sauvegarde, c.mission, c.fiches, c.formulaire.chantier], [3, null, null, {}, '']);
  assert.equal(durable(b).texte, d.texte);
  assert.match(b.texte(), /Chantier « temoin-atelier » restauré .* Mode OFF : passe en MANUEL pour continuer/);
  assert.equal(b.un('verdict-technique').textContent, 'Verdict : verification-impossible');
  // OFF : aucun geste ; Christophe repasse en MANUEL explicitement.
  for (const n of ['confronter', 'annuler', 'preparer-sauvegarde', 'enregistrer-confirmation']) assert.equal(b.un(n).disabled, true, n);
  await b.cliquer('mode-manuel');
  assert.equal(b.un('confronter').disabled, false);
});
test('restauration : abandon, et refus sur un atelier non vide (chantier ouvert, ou registre seul) ; jamais de fusion', async () => {
  const a = await conduire('lancee');
  const p = decouper(durable(a).texte, CH);
  const b = await vide();
  await coller(b, p);
  assert.equal(b.trouver('confirmer-restauration').length, 1);
  await b.cliquer('abandonner-restauration');
  assert.equal(b.trouver('confirmer-restauration').length, 0);
  assert.equal(b.copie().journal, null);
  // Atelier avec un chantier : la section montre la sauvegarde, jamais la restauration.
  const c = await conduire('ouvert');
  assert.equal(c.trouver('partie-restauration').length, 0);
  assert.equal(c.trouver('preparer-sauvegarde').length, 1);
  // Atelier sans chantier mais avec un registre : restauration impossible.
  const r = monterEcran({ version: VERSION });
  await r.cliquer('mode-manuel');
  await r.cliquer('temoin');
  await r.cliquer('ouvrir-cycle');
  assert.match(r.un('restauration-impossible').textContent, /l'atelier de cet appareil n'est pas vide/);
  assert.equal(r.trouver('ajouter-partie').length, 0);
  // Une copie restaurée est installée ENTIÈRE à la place d'un atelier vide : rien de la copie précédente n'est fusionné.
  const v = await vide();
  await v.cliquer('temoin'); // brouillon de formulaire (non durable)
  await coller(v, p);
  await v.cliquer('confirmer-restauration');
  assert.deepEqual([v.copie().formulaire.chantier, v.copie().fiches], ['', {}]);
});
test('restauration en OFF : consultation seulement ; aucun ajout ni aucune confirmation, même forcés', async () => {
  const a = await conduire('en-cours');
  const p = decouper(durable(a).texte, CH);
  const b = await vide();
  await coller(b, p);
  await b.cliquer('mode-off');
  const avant = b.stockage.getItem(CLE_ATELIER);
  for (const n of ['confirmer-restauration', 'ajouter-partie', 'abandonner-restauration']) { const x = b.un(n); assert.equal(x.disabled, true, n); x.disabled = false; for (const f of x.listeners.click) await f(); }
  assert.equal(b.un('partie-restauration').disabled, true);
  assert.equal(b.stockage.getItem(CLE_ATELIER), avant);
  assert.equal(b.copie().journal, null);
});
test('reprises : tentative lancée sans rapport, candidat sans faits, faits sans décision, chantier terminé — étape et verdict recalculés', async () => {
  const cas = [
    ['lancee', /Sauvegarde durable requise \(D3\)/, null],
    ['lancee-sauvegardee', /Sauvegarde durable requise \(D3\)/, null], // la sauvegarde confirmée n'est jamais durable : à reconfirmer
    ['demandee', /Ouvre le run, copie les faits/, null],
    ['faits', /aucune acceptation automatique/, 'verification-technique-conforme'],
    ['decide', /Chantier terminé/, null],
  ];
  const textes = {};
  await conduire('decide', { observer: (e, x) => { textes[e] = durable(x).texte; } });
  for (const [etape, consigne, verdict] of cas) {
    const b = await vide();
    await coller(b, [...decouper(textes[etape], CH)].reverse());
    await b.cliquer('confirmer-restauration');
    assert.match(b.un('prochaine-etape').textContent, consigne, etape);
    if (verdict) assert.equal(b.un('verdict-technique').textContent, `Verdict : ${verdict}`);
    assert.equal(JSON.stringify(b.copie().pieces).includes('verification-technique'), false, 'aucun verdict stocké');
    assert.equal(b.copie().sauvegarde, null);
    if (etape === 'decide') assert.match(b.un('accepte-temoin-1').textContent, /candidat accepté : atelier\/temoin-atelier\/temoin-1\/1@c{40}/);
  }
  // Tentative lancée restaurée : resauvegarder l'état identique (aucun commit côté Git) et coller sa confirmation débloque le dossier.
  const b = await vide();
  await coller(b, decouper(textes['lancee-sauvegardee'], CH));
  await b.cliquer('confirmer-restauration');
  await b.cliquer('mode-manuel');
  assert.equal(b.trouver('recopier-dossier').length, 0);
  await confirmerSauvegarde(b, 'e'.repeat(40));
  await b.cliquer('recopier-dossier');
  assert.deepEqual(b.copies.at(-1), construireMission(b.copie().pieces[K1].mission));
});
test('copie version 3 : relue telle quelle ; sauvegarde confirmée sabotée => copie illisible, rien n\'est réparé ni réécrit', async () => {
  const a = await conduire('lancee-sauvegardee');
  const bonne = a.copie();
  const relue = monterEcran({ version: VERSION, stockage: stockageMemoire(JSON.stringify(bonne)) });
  assert.deepEqual(relue.copie().sauvegarde, bonne.sauvegarde);
  assert.equal(relue.trouver('recopier-dossier').length, 1);
  assert.equal(relue.stockage.ecritures, 0);
  const casse = (f) => { const c = structuredClone(bonne); f(c); return JSON.stringify(c); };
  for (const brut of [
    casse((c) => { c.sauvegarde.evenements = c.journal.length + 1; }),
    casse((c) => { c.sauvegarde.evenements = 0; }),
    casse((c) => { c.sauvegarde.commit = 'x'; }),
    casse((c) => { c.sauvegarde.empreinte = 'E'.repeat(64); }),
    casse((c) => { c.sauvegarde.verdict = 'verification-technique-conforme'; }),
    casse((c) => { delete c.sauvegarde.commit; }),
    casse((c) => { c.journal = null; c.pieces = {}; c.mission = null; }),
  ]) {
    const s = stockageMemoire(brut);
    const b = monterEcran({ version: VERSION, stockage: s });
    assert.match(b.un('illisible').textContent, /sauvegarde confirmée (illisible|étrangère au chantier)/);
    assert.equal(s.ecritures, 0);
    assert.equal(s.getItem(CLE_ATELIER), brut);
  }
  // Copie version 2 (AT-6) : lue avec « aucune sauvegarde confirmée » ; rien n'est inventé.
  const v2 = { ...bonne, version: 2 };
  delete v2.sauvegarde;
  const b = monterEcran({ version: VERSION, stockage: stockageMemoire(JSON.stringify(v2)) });
  assert.match(b.un('sauvegarde-statut').textContent, /Aucune sauvegarde durable confirmée/);
  assert.equal(b.trouver('d3-attente').length, 1);
});
