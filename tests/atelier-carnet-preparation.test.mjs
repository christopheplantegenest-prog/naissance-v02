// v0.65.19 — AT-10.2 « PRÉPARATION AUTOMATIQUE D'UNE MISSION » (GO « AT-10.2 — GO RÉALISATION LOCALE », 21/10/2026 ; DA, DB, DC, DE).
// OUTILLAGE NON COGNITIF, aucun réseau. Section 12 conduite par les VRAIS gestes : « Préparer la mission 1 » (un geste, une écriture,
// état exact), refus sans écriture (OFF, carnet non sauvegardé, atelier non vide, panne, bouton périmé), fiche et appel figés,
// lancement MANUEL refusé, divergence locale (STOP) et « Rétablir », restauration, état durable altéré, chantier orphelin, E-T1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monterEcran, stockageMemoire } from './atelier-aide.mjs';
import { CLE_ATELIER, CLE_CARNET } from '../app/atelier/ecran.js';
import { ecrireEtatDurable } from '../app/atelier/journal.js';
import { etatCarnet, comparerChantier } from '../app/atelier/carnet.js';
import { construireMission } from '../app/atelier/mission.js';
import { BASE, APPEL, DEV, mission, instantane } from './atelier-carnet-aide.mjs';
import { V, carnet, installer, sauverCarnet, actif, copieChantier, missionOuverte, declencher, FORMULAIRE_M1, FICHES_M1 } from './atelier-carnet-ecran-aide.mjs';

// Écran avec carnet approuvé, mission 1 ouverte, carnet sauvegardé à jour, atelier VIDE (avant la préparation).
async function avantPreparation(mode = 'manuel') {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  await installer(a);
  await a.cliquer('approuver-carnet');
  await sauverCarnet(a);
  await a.cliquer('ouvrir-mission-1');
  await sauverCarnet(a);
  if (mode !== 'manuel') await a.cliquer(`mode-${mode}`);
  return a;
}
const eCarnet = (a) => etatCarnet(carnet(a).journal);

test('AT-10.2 écran : « Préparer la mission 1 » = UN geste, UNE écriture : chantier, plan approuvé, fiche, cycle, plafond et appel AUTO exacts', async () => {
  const a = await avantPreparation();
  assert.equal(actif(a, 'preparer-mission-1'), true);
  assert.match(a.un('carnet-portee-preparation').textContent, /Ni l'estimation ni le plafond ne valent approbation de l'appel \(V2\) ou dépense : rien n'est lancé, aucun appel/);
  const carnetAvant = a.stockage.getItem(CLE_CARNET);
  const ecritures = a.stockage.ecritures;
  await a.cliquer('preparer-mission-1');
  assert.equal(a.stockage.ecritures, ecritures + 1, 'une seule écriture (copie vérifiée entière)');
  assert.equal(a.stockage.getItem(CLE_CARNET), carnetAvant, 'le carnet n\'est pas modifié');
  const c = a.copie();
  assert.deepEqual(c.journal.map((x) => x.type), ['ouvert', 'plan-approuve'], 'aucune tentative : rien n\'est lancé');
  assert.deepEqual(c.journal[0].donnees, { id: 'carnet-essai-m1', objectif: mission(1).objectif, base: { ...BASE }, plan: [{ id: 'essai-1', titre: 'Essai 1', critere: 'Test essai-1 vert.', tentativesMax: 1 }] });
  assert.deepEqual(c.registre.map((x) => [x.type, x.donnees]), [['cycle-ouvert', { cycle: 'carnet-essai-m1', plafond: 150000, reserve: 0, plafondRun: 150000 }], ['chantier-plafonne', { chantier: 'carnet-essai-m1', plafond: 150000 }]]);
  assert.deepEqual(c.formulaire, FORMULAIRE_M1);
  assert.deepEqual(c.fiches, FICHES_M1);
  assert.deepEqual([c.mission, c.pieces, c.piecesDepuis, c.sauvegarde, c.mode], [null, {}, 1, null, 'MANUEL']);
  assert.equal(comparerChantier(eCarnet(a), 1, c), null);
  assert.match(a.un('message').textContent, /Mission 1 préparée en un geste.*estimation maximale 0,1012 USD.*NI approbation de l'appel \(V2\) NI dépense ; rien n'est lancé/);
  assert.equal(a.copies.length, 0, 'rien n\'est copié');
  for (const n of ['carnet-divergence', 'carnet-divergence-locale', 'preparer-mission-1']) assert.equal(a.trouver(n).length, 0, n);
  assert.match(a.un('carnet-bilan').textContent, /Chantier : en-cours — coût 0,00 USD/);
  assert.equal(eCarnet(a).missions[0].statut, 'ouverte');
});

test('AT-10.2 écran : de la préparation au lancement AUTO, dossier et lancement = exactement la mission approuvée (aucun lancement automatique)', async () => {
  const a = await avantPreparation('auto');
  await a.cliquer('preparer-mission-1');
  assert.equal(a.copie().journal.length, 2);
  await a.cliquer('generer');
  assert.deepEqual(a.copie().mission, JSON.parse(JSON.stringify(instantane(1))));
  assert.equal(a.un('dossier').value, construireMission(instantane(1)));
  assert.match(a.un('lancer-auto').textContent, /en AUTO avec APPEL DE DÉVELOPPEMENT/);
  assert.equal(a.copie().journal.length, 2, 'générer ne lance rien');
  await a.cliquer('lancer-auto');
  const c = a.copie();
  assert.deepEqual(c.journal[2].donnees, { jalon: 'essai-1', mode: 'AUTO', appel: { ...APPEL }, developpement: { ...DEV } });
  assert.deepEqual(c.registre[2].donnees, { execution: 'carnet-essai-m1/essai-1/1', chantier: 'carnet-essai-m1', maximum: 101200 });
  assert.deepEqual(c.pieces['essai-1/1'].mission, JSON.parse(JSON.stringify(instantane(1))));
  assert.equal(comparerChantier(eCarnet(a), 1, c), null);
  assert.equal(a.trouver('carnet-divergence-locale').length, 0);
  assert.equal(a.copies.length, 0, 'aucune demande copiée : la sauvegarde D3 et V2 restent humaines');
});

test('AT-10.2 écran : préparation refusée (OFF, carnet non sauvegardé, atelier non vide, panne, bouton périmé) : rien n\'est écrit', async () => {
  const a = await avantPreparation();
  const bouton = a.un('preparer-mission-1');
  await a.cliquer('mode-off');
  assert.equal(actif(a, 'preparer-mission-1'), false);
  let avant = a.stockage.getItem(CLE_ATELIER);
  await declencher(bouton);
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant, 'OFF : consultation seule');
  await a.cliquer('mode-manuel');
  // Carnet modifié depuis sa sauvegarde : bouton inactif, et la fonction refuse aussi.
  const c = carnet(a);
  a.stockage.setItem(CLE_CARNET, JSON.stringify({ ...c, sauvegarde: null }));
  a.ecran.rafraichir();
  assert.equal(actif(a, 'preparer-mission-1'), false);
  avant = a.stockage.getItem(CLE_ATELIER);
  await declencher(bouton);
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant);
  assert.match(a.texte(), /sauvegarde durable du carnet requise et à jour avant de préparer une mission/);
  // Atelier non vide (un autre chantier) : refus.
  a.stockage.setItem(CLE_CARNET, JSON.stringify(c));
  a.stockage.setItem(CLE_ATELIER, JSON.stringify(copieChantier({ etape: 'prepare' })));
  a.ecran.rafraichir();
  avant = a.stockage.getItem(CLE_ATELIER);
  await declencher(bouton);
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant);
  assert.match(a.texte(), /l'atelier du chantier n'est pas vide : rien n'est préparé/);
  // Panne de stockage pendant l'écriture : ni chantier, ni registre, ni fiche (aucune préparation partielle).
  const b = await avantPreparation();
  avant = b.stockage.getItem(CLE_ATELIER);
  b.stockage.panne = true;
  await b.cliquer('preparer-mission-1');
  b.stockage.panne = false;
  assert.equal(b.stockage.getItem(CLE_ATELIER), avant);
  assert.match(b.un('message').textContent, /non enregistrée sur cet appareil : rien n'est fait/);
  assert.equal(b.copie().journal, null);
  b.ecran.rafraichir();
  assert.equal(actif(b, 'preparer-mission-1'), true, 'rien n\'a été retenu : la préparation reste possible');
});

test('AT-10.2 écran : mission préparée = fiche et appel figés ; ni témoin, ni appel à blanc ; lancement MANUEL refusé', async () => {
  const a = await avantPreparation();
  await a.cliquer('preparer-mission-1');
  assert.match(a.un('fiche-figee-carnet').textContent, /mission du carnet approuvée \(V1\)/);
  for (const n of ['comportement', 'criteres', 'tests', 'autorises', 'interdits', 'frontieres']) assert.equal(a.un(n).disabled, true, n);
  for (const n of ['ajouter-decision']) assert.equal(actif(a, n), false, n);
  const avant = a.stockage.getItem(CLE_ATELIER);
  a.saisir('criteres', 'Autre critère.');
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant, 'saisie ignorée sur un champ figé');
  // MANUEL : le dossier se génère, mais le lancement MANUEL est refusé (mission de carnet = AUTO seulement).
  await a.cliquer('generer');
  await a.cliquer('lancer');
  assert.match(a.un('message').textContent, /lancement en AUTO seulement/);
  assert.equal(a.copie().journal.length, 2);
  await a.cliquer('mode-auto');
  assert.match(a.un('auto-fige-carnet').textContent, /Appel figé/);
  for (const n of ['auto-temoin', 'auto-temoin-reel', 'auto-developpement', 'auto-sans-developpement']) assert.equal(actif(a, n), false, n);
  for (const n of ['auto-modele', 'auto-entree-max', 'auto-max-tokens', 'auto-tarif-entree', 'auto-tarif-sortie', 'auto-dev-effort', 'auto-dev-entree', 'auto-dev-sortie', 'auto-dev-extraits', 'auto-dev-engagement']) assert.equal(a.un(n).disabled, true, n);
  assert.match(a.un('auto-estimation').textContent, /0,1012 USD/);
  // Bouton témoin dessiné hors carnet ? Il est inactif ; déclenché quand même, la garde du bouton ne fait rien.
  const avantAuto = a.stockage.getItem(CLE_ATELIER);
  await declencher(a.un('auto-temoin'));
  assert.equal(a.stockage.getItem(CLE_ATELIER), avantAuto);
});

test('AT-10.2 écran : préparation locale modifiée (fiche, appel, témoin, dossier) = DIVERGENCE LOCALE : ni dossier, ni lancement ; « Rétablir »', async () => {
  const alterations = [
    (c) => { c.fiches['essai-1'].criteres = 'Autre critère.'; },
    (c) => { c.fiches['essai-1'].decisions = [{ id: 'D-001', texte: 'Ajout non approuvé.' }]; },
    (c) => { c.formulaire.auto.max_tokens = '1024'; },
    (c) => { c.formulaire.auto.tarif_sortie = '25'; },
    (c) => { c.formulaire.developpement.maximum = '0,15'; },
    (c) => { c.formulaire.developpement.extraits = 'app/atelier/ecran.js 1-9'; },
    (c) => { c.formulaire.temoin = { jeton: '0'.repeat(32), tarif_entree: '', tarif_sortie: '', maximum: '0,001' }; },
    (c) => { c.mission = { ...instantane(1), criteres: ['Autre critère.'] }; },
  ];
  for (const [i, alterer] of alterations.entries()) {
    const a = await avantPreparation('auto');
    await a.cliquer('preparer-mission-1');
    if (i === 7) await a.cliquer('generer');
    const c = a.copie();
    alterer(c);
    a.stockage.setItem(CLE_ATELIER, JSON.stringify(c));
    a.ecran.rafraichir();
    assert.match(a.un('carnet-divergence-locale').textContent, /DIVERGENCE LOCALE avec la mission 1 .* STOP/, String(i));
    for (const n of ['enregistrer-livraison', 'clore-mission']) assert.equal(a.trouver(n).length, 0, n);
    const avant = a.stockage.getItem(CLE_ATELIER);
    await a.cliquer('generer');
    assert.match(a.texte(), /DIVERGENCE avec la mission 1 du carnet/, String(i));
    if (a.trouver('lancer-auto').length) { await a.cliquer('lancer-auto'); assert.match(a.texte(), /DIVERGENCE avec la mission 1 du carnet/); }
    assert.equal(JSON.parse(a.stockage.getItem(CLE_ATELIER)).journal.length, 2, `rien n'est lancé (${i})`);
    assert.equal(a.stockage.getItem(CLE_ATELIER), avant, `rien n'est écrit (${i})`);
    await a.cliquer('retablir-preparation');
    const r = a.copie();
    assert.deepEqual([r.formulaire, r.fiches], [FORMULAIRE_M1, FICHES_M1], String(i));
    assert.deepEqual([r.journal, r.registre, r.pieces], [c.journal, c.registre, c.pieces], 'journal, registre et pièces inchangés');
    assert.equal(a.trouver('carnet-divergence-locale').length, 0, String(i));
  }
});

test('AT-10.2 écran : restauration (fiche et formulaires vides) détectée ; « Rétablir » ne réécrit que le local ; état durable altéré = STOP sans rétablir', async () => {
  const { a, c } = await missionOuverte({ etape: 'lance' }, true);
  assert.equal(a.trouver('carnet-divergence-locale').length, 0);
  const restaure = copieChantier({ etape: 'lance' }, true, false);
  a.stockage.setItem(CLE_ATELIER, JSON.stringify(restaure));
  a.ecran.rafraichir();
  assert.match(a.un('carnet-divergence-locale').textContent, /préparation locale absente ou modifiée/);
  await a.cliquer('retablir-preparation');
  const r = a.copie();
  assert.deepEqual([r.formulaire, r.fiches, r.journal, r.registre, r.pieces, r.sauvegarde], [FORMULAIRE_M1, FICHES_M1, c.journal, c.registre, c.pieces, c.sauvegarde]);
  assert.equal(ecrireEtatDurable(r).empreinte, c.sauvegarde.empreinte, 'état durable identique : sauvegarde toujours à jour');
  // États durables incomplets ou altérés après restauration : DIVERGENCE, aucun rétablissement possible.
  const cas = [
    [{ etape: 'prepare', plafond: 100000 }, /plafond AT-2 du chantier différent/],
    [{ etape: 'lance', engagement: 150000 }, /engagement AT-2 différent/],
    [{ etape: 'lance', piece: { tests: ['tests/atelier-essai-1.test.mjs', 'tests/atelier-x.test.mjs'] } }, /instantané de la mission différent/],
    [{ etape: 'prepare', cycle: { cycle: '2026-10' } }, /cycle AT-2 différent/],
  ];
  for (const [o, motif] of cas) {
    a.stockage.setItem(CLE_ATELIER, JSON.stringify(copieChantier(o, true, false)));
    a.ecran.rafraichir();
    assert.match(a.un('carnet-divergence').textContent, motif);
    assert.equal(a.trouver('retablir-preparation').length, 0);
    const avant = a.stockage.getItem(CLE_ATELIER);
    if (o.etape === 'prepare') { await a.cliquer('generer'); assert.match(a.texte(), /DIVERGENCE avec la mission 1 du carnet/); }
    assert.equal(a.stockage.getItem(CLE_ATELIER), avant);
  }
});

test('AT-10.2 écran : chantier de mission sans son carnet sur l\'appareil : ni dossier, ni lancement', async () => {
  const a = monterEcran({ version: V, stockage: stockageMemoire(JSON.stringify(copieChantier({ etape: 'prepare' }))) });
  await a.cliquer('mode-manuel');
  const avant = a.stockage.getItem(CLE_ATELIER);
  await a.cliquer('generer');
  assert.match(a.texte(), /chantier d'une mission de carnet sans sa mission ouverte sur cet appareil/);
  assert.equal(a.stockage.getItem(CLE_ATELIER), avant);
});

test('AT-10.2 écran (E-T1) : effacements nommés (CHANTIER / CARNET), confirmations exclusives, chacun n\'efface que le sien', async () => {
  const { a } = await missionOuverte();
  assert.equal(a.un('effacer').textContent, 'Effacer le CHANTIER « carnet-essai-m1 » de cet appareil');
  assert.equal(a.un('effacer-carnet').textContent, 'Effacer le CARNET « carnet-essai » de cet appareil');
  await a.cliquer('effacer');
  assert.equal(a.un('effacer').textContent, 'Confirmer : effacer le CHANTIER « carnet-essai-m1 » (mode OFF, chantier local perdu, sauvegarde GitHub intacte)');
  // Toucher l'autre bouton DÉSARME la première confirmation : il demande la sienne et n'efface rien.
  const chantier = a.stockage.getItem(CLE_ATELIER);
  const leCarnet = a.stockage.getItem(CLE_CARNET);
  await a.cliquer('effacer-carnet');
  assert.equal(a.un('effacer-carnet').textContent, 'Confirmer : effacer le CARNET « carnet-essai » (carnet local perdu, sauvegarde GitHub intacte)');
  assert.equal(a.un('effacer').textContent, 'Effacer le CHANTIER « carnet-essai-m1 » de cet appareil');
  assert.deepEqual([a.stockage.getItem(CLE_ATELIER), a.stockage.getItem(CLE_CARNET)], [chantier, leCarnet]);
  await a.cliquer('effacer');
  assert.equal(a.un('effacer-carnet').textContent, 'Effacer le CARNET « carnet-essai » de cet appareil');
  assert.deepEqual([a.stockage.getItem(CLE_ATELIER), a.stockage.getItem(CLE_CARNET)], [chantier, leCarnet], 'aucun effacement sans sa propre confirmation');
  // Effacer le CARNET (confirmé) : le chantier reste.
  await a.cliquer('effacer-carnet');
  await a.cliquer('effacer-carnet');
  assert.equal(a.stockage.getItem(CLE_CARNET), null);
  assert.equal(a.stockage.getItem(CLE_ATELIER), chantier);
  assert.equal(a.un('effacer-carnet').textContent, 'Effacer le CARNET de cet appareil');
  // Effacer le CHANTIER (confirmé) : atelier vide en OFF ; le libellé ne nomme plus aucun chantier.
  await a.cliquer('effacer');
  await a.cliquer('effacer');
  assert.equal(a.stockage.getItem(CLE_ATELIER), null);
  assert.equal(a.un('effacer').textContent, 'Effacer le CHANTIER de cet appareil');
  // Sens inverse : effacer le chantier ne touche pas au carnet.
  const { a: b } = await missionOuverte();
  const carnetB = b.stockage.getItem(CLE_CARNET);
  await b.cliquer('effacer');
  await b.cliquer('effacer');
  assert.equal(b.stockage.getItem(CLE_ATELIER), null);
  assert.equal(b.stockage.getItem(CLE_CARNET), carnetB);
});
