// v0.65.20 — AT-10.3 « RELAIS DU CYCLE AUTOMATISÉ » (GO « AT-10.3 — GO RÉALISATION LOCALE », 21/10/2026 ; DG). OUTILLAGE NON COGNITIF,
// aucun réseau. D3 du carnet regroupée à l'écran (section 12, VRAIS gestes) : la mission k >= 2 s'ouvre sur une sauvegarde confirmée qui
// couvre la livraison de k-1 (suivie de sa seule validation), jamais sur une preuve supposée ; « Préparer » exige la sauvegarde suivante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLE_ATELIER, CLE_CARNET } from '../app/atelier/ecran.js';
import { canonique } from '../app/atelier/journal.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { etatCarnet, etatDurableCarnet, texteLivraison } from '../app/atelier/carnet.js';
import { livraison } from './atelier-carnet-aide.mjs';
import { carnet as carnetLocal, sauverCarnet, missionOuverte, actif } from './atelier-carnet-ecran-aide.mjs';

// Atelier du chantier vidé (comme après « Effacer le CHANTIER ») sans toucher au carnet.
const viderAtelier = (a) => { a.stockage.setItem(CLE_ATELIER, JSON.stringify({ ...JSON.parse(a.stockage.getItem(CLE_ATELIER)), journal: null, registre: null, mission: null, pieces: {}, sauvegarde: null })); a.ecran.rafraichir(); };

test('AT-10.3 écran : mission 2 ouverte sur une sauvegarde couvrant la livraison 1 (puis validation seule) ; « Préparer » exige la D3 suivante', async () => {
  const { a, c } = await missionOuverte();
  a.saisir('livraison-carnet', texteLivraison(livraison(1, { preuve: c.sauvegarde.empreinte })));
  await a.cliquer('enregistrer-livraison');
  assert.match(a.texte(), /Sauvegarde le carnet \(Claude y revérifie la livraison par git\)/);
  await sauverCarnet(a);
  await a.cliquer('valider-mission');
  assert.equal(etatCarnet(carnetLocal(a).journal).missions[0].statut, 'validee');
  // Atelier du chantier encore plein : refus pour cette raison seulement.
  assert.equal(actif(a, 'ouvrir-mission-2'), false);
  assert.match(a.un('carnet-avant-ouverture').textContent, /atelier du chantier non vide/);
  viderAtelier(a);
  assert.equal(actif(a, 'ouvrir-mission-2'), true, 'la sauvegarde couvre la livraison : ouverture permise sans nouvelle D3');
  await a.cliquer('ouvrir-mission-2');
  const e = etatCarnet(carnetLocal(a).journal);
  assert.deepEqual([e.missionCourante, e.missions[1].statut, e.missions[1].base.version], [2, 'ouverte', '0.65.18']);
  assert.match(a.texte(), /une seule sauvegarde pour la validation de la mission 1 et cette ouverture ; Claude y contrôle .* E1/);
  // « Préparer » exige la sauvegarde qui contient l'ouverture (rien n'est supposé).
  assert.equal(actif(a, 'preparer-mission-2'), false);
  assert.match(a.un('carnet-avant-preparation').textContent, /sauvegarde durable du carnet requise et à jour/);
  await sauverCarnet(a);
  assert.equal(actif(a, 'preparer-mission-2'), true);
});

test('AT-10.3 écran : ouverture de la mission 2 refusée si la sauvegarde ne couvre pas la livraison ou cite un autre état', async () => {
  // Sauvegarde antérieure à la livraison (ouverture de la mission 1 seulement) : refus.
  const { a, c } = await missionOuverte();
  await sauverCarnet(a);
  a.saisir('livraison-carnet', texteLivraison(livraison(1, { preuve: c.sauvegarde.empreinte })));
  await a.cliquer('enregistrer-livraison');
  await a.cliquer('valider-mission');
  viderAtelier(a);
  assert.equal(actif(a, 'ouvrir-mission-2'), false);
  assert.match(a.un('carnet-avant-ouverture').textContent, /ou couvrant la livraison de la mission 1/);
  // Sauvegarde dont l'empreinte ne correspond pas au préfixe (confirmation d'un autre état) : refus, même si le journal contient la livraison.
  const local = carnetLocal(a);
  const forge = { ...local, sauvegarde: { empreinte: '0'.repeat(64), commit: 'd'.repeat(40), evenements: local.journal.length - 1 } };
  a.stockage.setItem(CLE_CARNET, JSON.stringify(forge));
  a.ecran.rafraichir();
  assert.equal(actif(a, 'ouvrir-mission-2'), false);
  // Même journal, sauvegarde confirmée de son préfixe exact jusqu'à la livraison : permise (seule la validation suit).
  const juste = { ...local, journal: local.journal.slice(0, -1) };
  const empreinte = hacherSha256(canonique(etatDurableCarnet(juste.journal)));
  const couvre = { ...local, sauvegarde: { empreinte, commit: 'd'.repeat(40), evenements: juste.journal.length } };
  a.stockage.setItem(CLE_CARNET, JSON.stringify(couvre));
  a.ecran.rafraichir();
  assert.equal(actif(a, 'ouvrir-mission-2'), true, 'livraison sauvegardée + validation seule : permise');
});

test('AT-10.3 écran : tentative AUTO d\'une mission de carnet = consigne des relais (Claude dérive demandes AUTO et AT-5 ; V2, V3, V4 restent humaines)', async () => {
  const { a } = await missionOuverte({ etape: 'lance' });
  await a.cliquer('mode-auto');
  const consigne = a.un('auto-relais-carnet').textContent;
  assert.match(consigne, /Claude reconstruit lui-même cette demande .*demande-auto/);
  assert.match(consigne, /vérification AT-5 \(demande-at5\)/);
  assert.match(consigne, /Aucune dépense sans TON approbation de l'environnement atelier-auto \(V2\)/);
  assert.match(consigne, /\(V3\) et la livraison \(V4\) restent tes gestes/);
  // Le bouton de copie de la demande reste disponible (aucun geste retiré).
  assert.equal(a.trouver('copier-demande-auto').length, 1);
});
