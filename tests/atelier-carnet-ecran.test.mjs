// v0.65.18 — AT-10.1 « CARNET DE TROIS MISSIONS » : section 12 de l'écran Atelier, conduite par les VRAIS gestes (GO 21/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF. Preuves : collage d'une proposition (aperçu, empreinte), refus d'une 4e mission ou d'un dépassement dès le
// collage, approbation V1 en MANUEL seulement, sauvegarde du carnet exigée avant la mission 1, pré-remplissage d'un atelier VIDE, copie
// locale séparée (la copie du chantier n'est jamais réécrite par le carnet hors pré-remplissage), divergence = STOP, livraison seulement
// sur preuve recoupée (candidat, coût, sauvegarde), clôture d'échec = carnet bloqué, restauration, copie illisible, panne de stockage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monterEcran, stockageMemoire } from './atelier-aide.mjs';
import { CLE_ATELIER, CLE_CARNET } from '../app/atelier/ecran.js';
import { canonique, decouper, ecrireEtatDurable, texteConfirmation } from '../app/atelier/journal.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { empreinteProposition, etatDurableCarnet, texteLivraison, etatCarnet } from '../app/atelier/carnet.js';
import { CARNET, BASE, proposition, mission, chantierMission, livraison, ev, suite, ouverte, sha } from './atelier-carnet-aide.mjs';
import { ouvrirCarnet } from '../app/atelier/carnet.js';

const V = '0.65.18';
const P = proposition();
const EMP = empreinteProposition(P);
const parties = (v, id = CARNET) => decouper(canonique(v), id);
const carnet = (a) => JSON.parse(a.stockage.getItem(CLE_CARNET));
async function coller(a, textes) {
  for (const t of textes) { a.saisir('partie-carnet', t); await a.cliquer('ajouter-partie-carnet'); }
}
async function installer(a, p = P) {
  await coller(a, parties(p));
  await a.cliquer('installer-carnet');
}
async function sauverCarnet(a, commit = 'd'.repeat(40)) {
  await a.cliquer('preparer-sauvegarde-carnet');
  const empreinte = hacherSha256(canonique(etatDurableCarnet(carnet(a).journal)));
  a.saisir('confirmation-carnet', texteConfirmation({ chantier: CARNET, empreinte, commit }));
  await a.cliquer('enregistrer-confirmation-carnet');
}
const actif = (a, nom) => !a.un(nom).disabled;
// Copie locale du chantier de la mission 1 (journal, registre, sauvegarde confirmée à jour), installée comme par une restauration.
function copieChantier(o = {}, sauvegarde = true) {
  const c = chantierMission(1, o);
  const copie = { version: 3, mode: 'MANUEL', formulaire: { chantier: '', objectif: '', version: V, sha: '', jalons: [{ id: '', titre: '', critere: '', tentativesMax: '2' }], budget: { cycle: '', plafond: '', reserve: '', plafondRun: '', plafondChantier: '' } }, fiches: {}, journal: c.journal, registre: c.registre, mission: null, pieces: {}, piecesDepuis: c.journal.length + 1, sauvegarde: null };
  if (sauvegarde) copie.sauvegarde = { empreinte: ecrireEtatDurable(copie).empreinte, commit: 'e'.repeat(40), evenements: c.journal.length };
  return copie;
}
// Écran avec un carnet approuvé, sauvegardé, mission 1 ouverte ; puis le chantier m1 installé dans la copie du chantier.
async function missionOuverte(o, sauvegarde) {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  await installer(a);
  await a.cliquer('approuver-carnet');
  await sauverCarnet(a);
  await a.cliquer('ouvrir-mission-1');
  const c = copieChantier(o, sauvegarde);
  a.stockage.setItem(CLE_ATELIER, JSON.stringify(c));
  a.ecran.rafraichir();
  return { a, c };
}

test('carnet écran : section 12 visible en OFF, sans aucun geste possible', () => {
  const a = monterEcran({ version: V });
  assert.equal(a.un('partie-carnet').disabled, true);
  assert.equal(a.un('ajouter-partie-carnet').disabled, true);
  assert.match(a.texte(), /12\. Carnet de trois missions \(AT-10\.1\)/);
  assert.equal(a.stockage.getItem(CLE_CARNET), null);
});

test('carnet écran : proposition collée, aperçu avec empreinte, brouillon ; la copie du chantier est intacte', async () => {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  const chantierAvant = a.stockage.getItem(CLE_ATELIER);
  await coller(a, parties(P));
  assert.match(a.un('apercu-carnet-empreinte').textContent, new RegExp(EMP));
  assert.match(a.un('apercu-carnet-plafond').textContent, /Plafond total : 1,00 USD/);
  assert.match(a.un('apercu-mission-3').textContent, /Mission 3 — Essai 3 — plafond 0,15 USD/);
  assert.equal(a.stockage.getItem(CLE_CARNET), null, 'rien n\'est installé avant le geste');
  await a.cliquer('installer-carnet');
  assert.equal(etatCarnet(carnet(a).journal).statut, 'brouillon');
  assert.equal(a.stockage.getItem(CLE_ATELIER), chantierAvant);
  assert.match(a.un('carnet-statut').textContent, /statut brouillon/);
  assert.match(a.un('carnet-budget').textContent, /confirmé 0,00 USD — réservé 0,00 USD — disponible 1,00 USD/);
});

test('carnet écran : 4e mission, deux missions, dépassement du plafond : refusés dès le collage, rien n\'est conservé', async () => {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  const cas = [
    [{ ...P, missions: [...P.missions, mission(4)] }, /exactement 3 missions/],
    [{ ...P, missions: P.missions.slice(0, 2) }, /exactement 3 missions/],
    [{ ...P, missions: [mission(1, { plafond: 500001 }), mission(2), mission(3)] }, /plafond hors bornes/],
    [{ ...P, plafond_total: 400000 }, /somme des plafonds/],
    [{ ...P, missions: [mission(1, { autorises: ['app/atelier/auto.js'] }), mission(2), mission(3)] }, /perimetre-privilegie/],
  ];
  for (const [p, motif] of cas) {
    await coller(a, parties(p));
    assert.match(a.un('message').textContent, motif);
    assert.equal(a.trouver('installer-carnet').length, 0);
  }
  assert.equal(a.stockage.getItem(CLE_CARNET), null);
});

test('carnet écran : V1 en MANUEL seulement, sur l\'empreinte affichée', async () => {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-auto');
  await installer(a);
  assert.equal(actif(a, 'approuver-carnet'), false);
  assert.equal(a.trouver('carnet-v1-manuel').length, 1);
  await a.cliquer('mode-manuel');
  assert.match(a.un('carnet-portee-v1').textContent, new RegExp(EMP));
  await a.cliquer('approuver-carnet');
  const e = etatCarnet(carnet(a).journal);
  assert.equal(e.statut, 'approuve');
  assert.equal(carnet(a).journal[1].donnees.empreinte, EMP);
  assert.equal(a.trouver('approuver-carnet').length, 0);
});

test('carnet écran : mission 1 seulement après sauvegarde du carnet à jour et atelier vide ; formulaire pré-rempli', async () => {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  await installer(a);
  await a.cliquer('approuver-carnet');
  assert.equal(actif(a, 'ouvrir-mission-1'), false);
  assert.match(a.un('carnet-avant-ouverture').textContent, /sauvegarde durable du carnet requise/);
  assert.equal(a.trouver('ouvrir-mission-2').length, 0, 'jamais de mission hors ordre');
  // Confirmation d'un autre état : refusée.
  await a.cliquer('preparer-sauvegarde-carnet');
  assert.equal(a.trouver('copier-partie-carnet-1').length, 1);
  a.saisir('confirmation-carnet', texteConfirmation({ chantier: CARNET, empreinte: '0'.repeat(64), commit: 'd'.repeat(40) }));
  await a.cliquer('enregistrer-confirmation-carnet');
  assert.match(a.un('message').textContent, /autre état/);
  await sauverCarnet(a);
  assert.match(a.un('carnet-sauvegarde-statut').textContent, /à jour/);
  assert.equal(actif(a, 'ouvrir-mission-1'), true);
  await a.cliquer('ouvrir-mission-1');
  const f = a.copie().formulaire;
  assert.deepEqual({ chantier: f.chantier, objectif: f.objectif, version: f.version, sha: f.sha, jalons: f.jalons }, { chantier: 'carnet-essai-m1', objectif: mission(1).objectif, version: '0.65.17', sha: BASE.sha, jalons: [{ id: 'essai-1', titre: 'Essai 1', critere: 'Test essai-1 vert.', tentativesMax: '1' }] });
  assert.equal(a.copie().journal, null, 'le chantier n\'est pas ouvert à la place de Christophe');
  const e = etatCarnet(carnet(a).journal);
  assert.deepEqual([e.statut, e.missionCourante, e.budget.reserve], ['en-cours', 1, 150000]);
  assert.match(a.un('carnet-sauvegarde-statut').textContent, /sauvegarde à refaire/);
  // Le chantier s'ouvre par les gestes ordinaires (section 1) avec le formulaire pré-rempli.
  await a.cliquer('ouvrir');
  assert.equal(a.copie().journal[0].donnees.id, 'carnet-essai-m1');
  assert.equal(a.copie().journal[0].donnees.plan[0].tentativesMax, 1);
  assert.equal(a.trouver('carnet-divergence').length, 0);
  assert.match(a.un('carnet-bilan').textContent, /Chantier : ouvert — coût INCONNU/);
});

test('carnet écran : atelier du chantier non vide => mission refusée (rien n\'est écrit)', async () => {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  a.stockage.setItem(CLE_ATELIER, JSON.stringify(copieChantier()));
  a.ecran.rafraichir();
  await installer(a);
  await a.cliquer('approuver-carnet');
  await sauverCarnet(a);
  assert.equal(actif(a, 'ouvrir-mission-1'), false);
  assert.match(a.un('carnet-avant-ouverture').textContent, /atelier du chantier non vide/);
});

test('carnet écran : divergence du chantier = alerte STOP, ni livraison ni clôture', async () => {
  const { a } = await missionOuverte({ change: { objectif: 'Un autre objectif.' } });
  assert.match(a.un('carnet-divergence').textContent, /DIVERGENCE.*objectif du chantier différent de la mission.*STOP/);
  for (const n of ['enregistrer-livraison', 'clore-mission', 'livraison-carnet']) assert.equal(a.trouver(n).length, 0, n);
});

test('carnet écran : livraison seulement sur preuve recoupée (candidat, coût, sauvegarde à jour), puis validation', async () => {
  const { a, c } = await missionOuverte();
  assert.match(a.un('carnet-bilan').textContent, /terminé|termine/);
  assert.match(a.un('carnet-livraison-portee').textContent, /Accepter un candidat ne vaut pas livraison/);
  const bonne = livraison(1, { preuve: c.sauvegarde.empreinte });
  const essais = [
    [{ ...bonne, cout: 90000 }, /coût de la preuve \(90000\) différent/],
    [{ ...bonne, candidat: sha('c') }, /pas terminé sur ce candidat accepté/],
    [{ ...bonne, preuve: '0'.repeat(64) }, /sauvegarde durable confirmée et à jour/],
    [{ ...bonne, carnet: 'carnet-autre' }, /autre carnet/],
  ];
  for (const [d, motif] of essais) {
    a.saisir('livraison-carnet', texteLivraison(d));
    await a.cliquer('enregistrer-livraison');
    assert.match(a.un('message').textContent, motif);
  }
  a.saisir('livraison-carnet', 'ATELIER-LIVRAISON-1 n\'importe quoi');
  await a.cliquer('enregistrer-livraison');
  assert.match(a.un('message').textContent, /illisible/);
  assert.equal(etatCarnet(carnet(a).journal).missions[0].statut, 'ouverte');
  a.saisir('livraison-carnet', texteLivraison(bonne));
  await a.cliquer('enregistrer-livraison');
  const e = etatCarnet(carnet(a).journal);
  assert.deepEqual([e.missions[0].statut, e.budget.confirme, e.budget.reserve], ['livree', 100000, 0]);
  await a.cliquer('valider-mission');
  assert.equal(etatCarnet(carnet(a).journal).missions[0].statut, 'validee');
  // Mission 2 : carnet à sauvegarder, atelier à vider.
  assert.equal(actif(a, 'ouvrir-mission-2'), false);
  assert.equal(a.trouver('ouvrir-mission-3').length, 0);
});

test('carnet écran : livraison refusée si la sauvegarde du chantier n\'est pas confirmée', async () => {
  const { a } = await missionOuverte({}, false);
  a.saisir('livraison-carnet', texteLivraison(livraison(1, { preuve: '1'.repeat(64) })));
  await a.cliquer('enregistrer-livraison');
  assert.match(a.un('message').textContent, /sauvegarde durable confirmée et à jour/);
});

test('carnet écran : clôture d\'échec (confirmée), carnet bloqué sans relance, puis arrêt', async () => {
  const { a } = await missionOuverte({ payer: false, accepter: false });
  assert.match(a.un('carnet-bilan').textContent, /coût INCONNU/);
  assert.match(a.un('clore-mission').textContent, /issue-inconnue/);
  await a.cliquer('clore-mission');
  assert.equal(etatCarnet(carnet(a).journal).missions[0].statut, 'ouverte', 'premier toucher : confirmation demandée');
  await a.cliquer('clore-mission');
  const e = etatCarnet(carnet(a).journal);
  assert.deepEqual([e.statut, e.missions[0].issue, e.budget.reserve], ['bloque', 'issue-inconnue', 150000]);
  for (const n of ['ouvrir-mission-2', 'clore-mission', 'enregistrer-livraison']) assert.equal(a.trouver(n).length, 0, n);
  await a.cliquer('arreter-carnet');
  assert.match(a.un('message').textContent, /motif de l'arrêt obligatoire/);
  a.saisir('motif-carnet', 'Issue inconnue de la mission 1.');
  await a.cliquer('arreter-carnet');
  assert.equal(etatCarnet(carnet(a).journal).statut, 'arrete');
  assert.equal(a.trouver('arreter-carnet').length, 0);
});

test('carnet écran : restauration d\'un carnet sauvegardé (aperçu, confirmation), refusée si un carnet existe', async () => {
  const j = suite(ouvrirCarnet(P, '2026-10-21T12:00:00Z'), ev('carnet-approuve', { empreinte: EMP }), ouverte(1));
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  await coller(a, parties(etatDurableCarnet(j)));
  assert.match(a.un('apercu-carnet-empreinte').textContent, /statut en-cours/);
  assert.match(a.un('apercu-mission-1').textContent, /Mission 1 — ouverte/);
  await a.cliquer('installer-carnet');
  assert.deepEqual(carnet(a).journal, JSON.parse(JSON.stringify(j)));
  assert.equal(carnet(a).sauvegarde, null);
  assert.equal(a.trouver('partie-carnet').length, 0, 'un carnet existe : plus de collage');
});

test('carnet écran : copie du carnet illisible => rien n\'est utilisé, seul l\'effacement reste', async () => {
  const s = stockageMemoire();
  const j = JSON.parse(JSON.stringify(suite(ouvrirCarnet(P, '2026-10-21T12:00:00Z'), ev('carnet-approuve', { empreinte: EMP }))));
  j[0].donnees.missions[0].plafond = 160000;
  s.setItem(CLE_CARNET, JSON.stringify({ version: 1, journal: j, sauvegarde: null }));
  const a = monterEcran({ version: V, stockage: s });
  assert.match(a.un('carnet-illisible').textContent, /empreinte approuvée différente/);
  assert.equal(a.trouver('carnet-statut').length, 0);
  await a.cliquer('effacer-carnet');
  await a.cliquer('effacer-carnet');
  assert.equal(s.getItem(CLE_CARNET), null);
  assert.equal(a.trouver('partie-carnet').length, 1);
});

// Bouton dessiné dans un état permis, déclenché après un changement d'état : la garde de la FONCTION refuse (rien n'est écrit).
const declencher = async (bouton) => { for (const f of bouton.listeners.click) await f(); };
test('carnet écran : boutons périmés — V1 hors MANUEL, mission sans sauvegarde à jour ou atelier non vide, livraison divergente', async () => {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  await installer(a);
  const v1 = a.un('approuver-carnet');
  await a.cliquer('mode-auto');
  let s = a.stockage.getItem(CLE_CARNET);
  await declencher(v1);
  assert.equal(a.stockage.getItem(CLE_CARNET), s, 'V1 refusée en AUTO');
  await a.cliquer('mode-manuel');
  await a.cliquer('approuver-carnet');
  await sauverCarnet(a);
  const m1 = a.un('ouvrir-mission-1');
  const c = carnet(a);
  a.stockage.setItem(CLE_CARNET, JSON.stringify({ ...c, sauvegarde: null }));
  a.ecran.rafraichir();
  s = a.stockage.getItem(CLE_CARNET);
  await declencher(m1);
  assert.equal(a.stockage.getItem(CLE_CARNET), s, 'mission refusée sans sauvegarde à jour');
  assert.match(a.texte(), /sauvegarde durable du carnet requise et à jour avant d'ouvrir une mission/);
  a.stockage.setItem(CLE_CARNET, JSON.stringify(c));
  a.stockage.setItem(CLE_ATELIER, JSON.stringify(copieChantier()));
  a.ecran.rafraichir();
  await declencher(m1);
  assert.equal(a.stockage.getItem(CLE_CARNET), JSON.stringify(c), 'mission refusée, atelier non vide');
  assert.match(a.texte(), /l'atelier du chantier n'est pas vide/);
  // Livraison : bouton dessiné sur un chantier conforme, puis chantier divergent (même candidat, même coût, preuve à jour) : refusée.
  const { a: b } = await missionOuverte();
  const divergent = copieChantier({ change: { objectif: 'Un autre objectif.' } });
  b.saisir('livraison-carnet', texteLivraison(livraison(1, { preuve: divergent.sauvegarde.empreinte })));
  const liv = b.un('enregistrer-livraison');
  b.stockage.setItem(CLE_ATELIER, JSON.stringify(divergent));
  b.ecran.rafraichir();
  s = b.stockage.getItem(CLE_CARNET);
  await declencher(liv);
  assert.equal(b.stockage.getItem(CLE_CARNET), s);
  assert.match(b.texte(), /DIVERGENCE/);
});

test('carnet écran : panne de stockage => geste refusé, carnet inchangé', async () => {
  const a = monterEcran({ version: V });
  await a.cliquer('mode-manuel');
  await installer(a);
  const avant = a.stockage.getItem(CLE_CARNET);
  a.stockage.panne = true;
  await a.cliquer('approuver-carnet');
  assert.match(a.un('message').textContent, /non enregistrée sur cet appareil : rien n'est fait/);
  a.stockage.panne = false;
  assert.equal(a.stockage.getItem(CLE_CARNET), avant);
  assert.equal(etatCarnet(carnet(a).journal).statut, 'brouillon');
});
