// v0.65.21 — AT-10.4 « RETOUR DES FAITS SANS RECOPIE » (GO « AT-10.4 — GO RÉALISATION LOCALE », 21/10/2026 ; DI = F2, DJ, DO).
// OUTILLAGE NON COGNITIF. Écran, section 11 : UN collage du bloc ATELIER-RETOUR-1 sur le rejeu réel du jalon 2 du pilote AT-9 (état
// e7ee7e87, J2 4c383d8b, J4 27185b94, AT-5 39485411) : lecture sans écriture, empreintes à comparer, faits placés dans les champs
// existants, puis gestes habituels (lire, enregistrer, confronter, accepter) ; refus (autre T, autre D3, bloc altéré, sans sauvegarde) ;
// repli F1 inchangé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { monterEcran } from './atelier-aide.mjs';
import { decouper, texteConfirmation } from '../app/atelier/journal.js';
import { texteRetour } from '../app/atelier/retour.js';
import { etatDe } from '../app/atelier/chantier.js';
import { CH, T, E7, COMMIT_E7, D3, RUNS, TEXTES, J2, J4, AT5, RUN_AT5 } from './atelier-retour-aide.mjs';

const VERSION = '0.65.21';
const h = (t) => createHash('sha256').update(t).digest('hex');
const BLOC = texteRetour({ tentative: T, runs: RUNS, d3: D3, textes: TEXTES });

async function pret({ commit = COMMIT_E7, confirmer = true } = {}) {
  const a = monterEcran({ version: VERSION });
  await a.cliquer('mode-manuel');
  for (const p of decouper(E7, CH)) { a.saisir('partie-restauration', p); await a.cliquer('ajouter-partie'); }
  await a.cliquer('confirmer-restauration');
  await a.cliquer('mode-auto');
  if (confirmer) {
    a.saisir('confirmation-sauvegarde', texteConfirmation({ chantier: CH, empreinte: h(E7), commit }));
    await a.cliquer('enregistrer-confirmation');
  }
  return a;
}
const message = (a) => a.texte().split('\n').filter((l) => /Retour de Claude|Faits placés|Faits non placés/.test(l));

test('E1 un collage : lecture sans écriture, empreintes de chaque fait, « (utilisé) » pour J2, J4, AT-5, consigne de comparaison (DJ)', async () => {
  const a = await pret();
  assert.equal(a.trouver('utiliser-retour').length, 0);
  a.saisir('retour-mission', BLOC);
  const avant = a.stockage.ecritures;
  await a.cliquer('lire-retour-mission');
  assert.equal(a.stockage.ecritures, avant, 'rien n\'est écrit par la lecture');
  assert.match(a.un('retour-lu').textContent, new RegExp(`^RETOUR DE CLAUDE LISIBLE — T = ${T} — D3 ${COMMIT_E7.slice(0, 12)} — empreinte du bloc [0-9a-f]{16}…$`));
  const libelle = { j1: 'J1 garde', j2f: 'J2 frontière', j2: 'J2 appel', j3: 'J3 constat', j4: 'J4 candidat', at5: 'AT-5 vérification' };
  for (const g of Object.keys(libelle)) {
    const run = g === 'at5' ? RUN_AT5 : RUNS.auto.run_id;
    assert.equal(a.un(`retour-fait-${g}`).textContent, `${libelle[g]} — run ${run} — empreinte ${h(TEXTES[g]).slice(0, 16)}${['j2', 'j4', 'at5'].includes(g) ? ' (utilisé)' : ''}`);
  }
  assert.match(a.un('retour-consigne').textContent, /^CONTRÔLE OBLIGATOIRE : .*ATELIER-FAITS-1.*même empreinte/);
  assert.equal(a.un('utiliser-retour').textContent, 'Empreintes comparées sur GitHub : utiliser ces faits');
  assert.match(message(a)[0], /Retour de Claude lisible .* Rien n'est encore écrit\./);
});

test('E2 « utiliser ces faits » : champs F1 remplis (J2, J4, AT-5), puis gestes habituels jusqu\'à l\'acceptation', async () => {
  const a = await pret();
  a.saisir('retour-mission', BLOC);
  await a.cliquer('lire-retour-mission');
  const avant = a.stockage.ecritures;
  await a.cliquer('utiliser-retour');
  assert.equal(a.stockage.ecritures, avant, 'rien n\'est écrit en plaçant les faits');
  assert.equal(a.un('faits-auto').value, J2);
  assert.equal(a.un('faits-candidat').value, J4);
  assert.match(message(a).at(-1), /Faits placés : J2 appel, J4 candidat, AT-5 vérification\./);
  assert.equal(a.trouver('enregistrer-auto').length, 0, 'la lecture habituelle reste à faire');
  await a.cliquer('lire-faits-auto');
  await a.cliquer('enregistrer-auto');
  assert.equal(a.trouver('retour-mission').length, 0, 'tentative rendue : la section 11 ne propose plus le retour');
  assert.equal(a.un('faits-colles').value, AT5, 'faits AT-5 placés dans le champ habituel');
  await a.cliquer('confronter');
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-conforme');
  a.saisir('motif-decision', 'Rejeu AT-10.4 par le retour de Claude.');
  await a.cliquer('accepter');
  assert.equal(etatDe(a.copie().journal).statut, 'termine');
});

test('E3 refus : autre tentative, autre D3, bloc altéré ou tronqué, sans sauvegarde confirmée ; rien n\'est placé', async () => {
  const essais = [
    [{}, texteRetour({ tentative: `${CH}/run-at5/2`, runs: RUNS, d3: D3, textes: TEXTES }), /retour d'une autre tentative/],
    [{ commit: 'a'.repeat(40) }, BLOC, /D3 du retour différente de la sauvegarde confirmée/],
    [{}, BLOC.replace(/\n[A-Za-z0-9+/]{76}\n/, '\n'), /Base64|longueur|empreinte/],
    [{}, BLOC.split('\n').slice(0, 5).join('\n'), /fin du retour absente/],
    [{}, J2, /début du retour absent/],
    [{ confirmer: false }, BLOC, /sauvegarde durable confirmée requise/],
  ];
  for (const [o, bloc, motif] of essais) {
    const a = await pret(o);
    a.saisir('retour-mission', bloc);
    await a.cliquer('lire-retour-mission');
    assert.match(message(a)[0], new RegExp(`Retour de Claude refusé : .*${motif.source}.*la copie manuelle des faits reste possible\\.`));
    assert.equal(a.trouver('utiliser-retour').length, 0);
    assert.equal(a.un('faits-auto').value, '');
  }
});

test('E4 lecture périmée : le bloc modifié après lecture n\'est pas utilisable ; repli F1 inchangé (collage manuel J2 et J4)', async () => {
  const a = await pret();
  a.saisir('retour-mission', BLOC);
  await a.cliquer('lire-retour-mission');
  a.saisir('retour-mission', `${BLOC} `);
  await a.cliquer('utiliser-retour');
  assert.match(message(a).at(-1), /Faits non placés : lis d'abord le retour de Claude\./);
  assert.equal(a.un('faits-auto').value, '');
  assert.equal(a.trouver('utiliser-retour').length, 0, 'redessiné : la lecture ne vaut plus pour ce texte');
  assert.equal(a.un('retour-repli').textContent, 'Sans retour de Claude : colle les faits à la main ci-dessous (mêmes contrôles).');
  a.saisir('faits-auto', J2);
  a.saisir('faits-candidat', J4);
  await a.cliquer('lire-faits-auto');
  assert.equal(a.trouver('enregistrer-auto').length, 1);
});
