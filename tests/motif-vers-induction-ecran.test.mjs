// v0.24 — DÉCISION CHATGPT « EXPÉRIENCES → INDUCTION » (27/09/2026).
//
// Objectif : depuis le vécu réel (B1), repérer un motif récurrent (repererMotifs(), déjà existant),
// le charger — par son numéro, sans retaper aucune phrase — dans le VRAI banc d'essai d'induction
// déjà existant (positifsEtNegatifsDepuisMotif(), induction.js, nouvelle, pure), puis laisser les
// VRAIS boutons Lancer/Confirmer déjà câblés faire tout le reste. Aucun second moteur : induire()/
// apprendreGabaritType()/comprendre() restent 100% ceux déjà en place et déjà testés ailleurs. Les
// jugements correct/incorrect n'entrent JAMAIS dans ce raccord (pipeline distinct, inchangé).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  magasinMemoireVive, enregistrerExperience, enregistrerJugement,
} from '../app/langage/connaissances.js';
import { chargerEsprit, repondre } from '../app/langage/esprit.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const ecranJs = readFileSync(join(RACINE_APP, 'langage', 'ecran.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
class Faux {
  constructor() { this.listeners = {}; this.disabled = false; this.hidden = false; this.textContent = ''; this.value = ''; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  async declencher(t) { for (const f of this.listeners[t] || []) await f({ preventDefault() {} }); }
}
globalThis.document = { createElement: () => universel() };
globalThis.window = globalThis;
const { monterEcranLangage } = await import('../app/langage/ecran.js');

async function monter() {
  const magasin = magasinMemoireVive();
  const el = {
    inductionPositifs: new Faux(), inductionNegatifs: new Faux(), inductionSignification: new Faux(),
    inductionLancer: new Faux(), inductionConfirmer: new Faux(), inductionAnnuler: new Faux(),
    inductionEtat: new Faux(), inductionRapport: new Faux(),
    inductionTestTexte: new Faux(), inductionTestLancer: new Faux(), inductionTestResultat: new Faux(),
    motifsLister: new Faux(), motifsEtat: new Faux(), motifsRapport: new Faux(),
    motifsNumero: new Faux(), motifsUtiliser: new Faux(), motifsUtiliserEtat: new Faux(),
  };
  el.inductionConfirmer.disabled = true; el.inductionAnnuler.disabled = true;
  el.inductionRapport.hidden = true; el.motifsRapport.hidden = true;
  const carte = {
    'data-langage-induction-positifs': 'inductionPositifs',
    'data-langage-induction-negatifs': 'inductionNegatifs',
    'data-langage-induction-signification': 'inductionSignification',
    'data-langage-induction-lancer': 'inductionLancer',
    'data-langage-induction-confirmer': 'inductionConfirmer',
    'data-langage-induction-annuler': 'inductionAnnuler',
    'data-langage-induction-etat': 'inductionEtat',
    'data-langage-induction-rapport': 'inductionRapport',
    'data-langage-induction-test-texte': 'inductionTestTexte',
    'data-langage-induction-test-lancer': 'inductionTestLancer',
    'data-langage-induction-test-resultat': 'inductionTestResultat',
    'data-langage-motifs-lister': 'motifsLister',
    'data-langage-motifs-etat': 'motifsEtat',
    'data-langage-motifs-rapport': 'motifsRapport',
    'data-langage-motifs-numero': 'motifsNumero',
    'data-langage-motifs-utiliser': 'motifsUtiliser',
    'data-langage-motifs-utiliser-etat': 'motifsUtiliserEtat',
  };
  const zone = {
    querySelector: (sel) => {
      const m = sel.match(/^\[([a-z0-9-]+)\]$/);
      const cle = m && carte[m[1]];
      return cle ? el[cle] : universel();
    },
  };
  const ecran = monterEcranLangage({ zone, ouvrirStockage: async () => magasin, confirmer: () => true });
  return { el, ecran, magasin };
}

async function experiencesZiqualo(magasin) {
  const t = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
  const pos1 = await enregistrerExperience(magasin, { texteRecu: 'Ziqualo, mon bouloir est vert.', texteRepondu: 'Je ne sais pas.', date: t(0), source: 'laboratoire' });
  const pos2 = await enregistrerExperience(magasin, { texteRecu: 'Ziqualo, ma teinte est jaune.', texteRepondu: 'Je ne sais pas.', date: t(1), source: 'laboratoire' });
  const neg1 = await enregistrerExperience(magasin, { texteRecu: 'Mon bouloir est vert.', texteRepondu: 'Je ne sais pas.', date: t(2), source: 'laboratoire' });
  const neg2 = await enregistrerExperience(magasin, { texteRecu: 'Ma teinte est jaune.', texteRepondu: 'Je ne sais pas.', date: t(3), source: 'laboratoire' });
  return { pos1, pos2, neg1, neg2 };
}

// -------------------------------------------------------------------- 1 — motif repéré depuis le VRAI vécu, numéroté
test('[ROUGE] « Repérer les motifs » affiche un numéro pour chaque motif constaté', async () => {
  const { el, magasin } = await monter();
  await experiencesZiqualo(magasin);
  await el.motifsLister.declencher('click');
  assert.match(el.motifsRapport.textContent, /numéro : 1/);
});

// -------------------------------------------------------------------- 2 — utiliser un motif remplit positifs/négatifs SANS retaper
test('[ROUGE] « Utiliser ce motif » remplit positifs = couverture du motif, négatifs = le reste du vécu récent, sans induire()', async () => {
  const { el, magasin } = await monter();
  await experiencesZiqualo(magasin);
  await el.motifsLister.declencher('click');
  const m = el.motifsRapport.textContent.match(/— mot:ziqualo\s*\n\s*numéro : (\d+)/);
  assert.ok(m, 'le motif [mot:ziqualo] doit être constaté et numéroté');
  el.motifsNumero.value = m[1];
  await el.motifsUtiliser.declencher('click');
  // Ordre = pool récent d'abord (poolExperiencesRecentes, v0.24) : la plus récente en tête, pas
  // l'ordre d'enregistrement -- seul l'ENSEMBLE compte pour induire(), jamais l'ordre des lignes.
  assert.equal(el.inductionPositifs.value, 'Ziqualo, ma teinte est jaune.\nZiqualo, mon bouloir est vert.');
  assert.equal(el.inductionNegatifs.value, 'Ma teinte est jaune.\nMon bouloir est vert.');
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []); // rien appris avant Lancer/Confirmer.
});

// -------------------------------------------------------------------- 3 — numéro invalide, message clair, rien ne change
test('[ROUGE] un numéro invalide (0, trop grand, ou avant tout clic) est signalé, sans planter et sans toucher aux champs d\'induction', async () => {
  const { el, magasin } = await monter();
  await experiencesZiqualo(magasin);
  el.motifsNumero.value = '1';
  await el.motifsUtiliser.declencher('click'); // avant tout « Repérer les motifs »
  assert.match(el.motifsUtiliserEtat.textContent, /repérer les motifs/i);
  assert.equal(el.inductionPositifs.value, '');

  await el.motifsLister.declencher('click');
  el.motifsNumero.value = '999';
  await el.motifsUtiliser.declencher('click');
  assert.match(el.motifsUtiliserEtat.textContent, /invalide/i);
  assert.equal(el.inductionPositifs.value, '');
});

// -------------------------------------------------------------------- 4, 5, 6 — BOUT EN BOUT : vécu réel -> motif -> induction -> confirmation -> reconnaissance
test('[ROUGE→VERT ATTENDU] bout en bout : vécu réel -> motif -> banc d\'essai -> confirmation -> gabaritType -> phrase jamais vue reconnue', async () => {
  const { el, magasin } = await monter();
  await experiencesZiqualo(magasin);

  await el.motifsLister.declencher('click');
  const m = el.motifsRapport.textContent.match(/— mot:ziqualo\s*\n\s*numéro : (\d+)/);
  el.motifsNumero.value = m[1];
  await el.motifsUtiliser.declencher('click');

  // Les VRAIS boutons d'induction déjà existants, jamais un second mécanisme.
  await el.inductionLancer.declencher('click');
  assert.match(el.inductionEtat.textContent, /hypothèse/);
  assert.equal(el.inductionConfirmer.disabled, false);

  el.inductionSignification.value = 'TYPE_VECU';
  await el.inductionConfirmer.declencher('click');
  assert.match(el.inductionEtat.textContent, /Confirmé/);

  const gabarits = await magasin.lireTout('gabaritsTypes');
  assert.equal(gabarits.length, 1);
  assert.equal(gabarits[0].signification, 'TYPE_VECU');

  // Phrase JAMAIS vue, jamais utilisée pour l'induction.
  el.inductionTestTexte.value = 'Ziqualo, mon dagoulin est petit.';
  await el.inductionTestLancer.declencher('click');
  assert.match(el.inductionTestResultat.textContent, /TYPE_VECU/);
});

// -------------------------------------------------------------------- 7 — persistance après rechargement complet
test('[ROUGE] la reconnaissance apprise depuis le vécu réel survit à un rechargement complet (nouvel esprit, même magasin)', async () => {
  const { el, magasin } = await monter();
  await experiencesZiqualo(magasin);
  await el.motifsLister.declencher('click');
  const m = el.motifsRapport.textContent.match(/— mot:ziqualo\s*\n\s*numéro : (\d+)/);
  el.motifsNumero.value = m[1];
  await el.motifsUtiliser.declencher('click');
  await el.inductionLancer.declencher('click');
  el.inductionSignification.value = 'TYPE_VECU';
  await el.inductionConfirmer.declencher('click');

  const fraisEsprit = await chargerEsprit(magasin);
  const r = repondre(fraisEsprit, 'Ziqualo, mon dagoulin est petit.');
  assert.equal(r.comprehension.type, 'TYPE_VECU');
});

// -------------------------------------------------------------------- 8 — contraste insuffisant/conflictuel : rien n'est forcé
test('[ROUGE] un motif sans négatif exploitable (couvre tout le vécu récent) ne force aucune conclusion : le VRAI induire() décide seul, comme toujours', async () => {
  const { el, magasin } = await monter();
  await enregistrerExperience(magasin, { texteRecu: 'Ziqualo, bonjour.', texteRepondu: 'Je ne sais pas.', date: new Date().toISOString(), source: 'laboratoire' });
  await enregistrerExperience(magasin, { texteRecu: 'Ziqualo, au revoir.', texteRepondu: 'Je ne sais pas.', date: new Date().toISOString(), source: 'laboratoire' });
  await el.motifsLister.declencher('click');
  const m = el.motifsRapport.textContent.match(/— mot:ziqualo\s*\n\s*numéro : (\d+)/);
  el.motifsNumero.value = m[1];
  await el.motifsUtiliser.declencher('click');
  assert.equal(el.inductionNegatifs.value, ''); // aucun négatif fabriqué.
  // Le VRAI bouton Lancer prend le relais : ce test ne préjuge pas de son verdict exact (déjà
  // couvert ailleurs, tests/induction.test.mjs), seulement qu'aucune écriture n'a lieu avant Confirmer.
  await el.inductionLancer.declencher('click');
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
});

// -------------------------------------------------------------------- 9 — jugements correct/incorrect SANS influence
test('[ROUGE] juger des expériences correct/incorrect ne change RIEN aux positifs/négatifs construits depuis un motif', async () => {
  const { el, magasin } = await monter();
  const { pos1, neg1 } = await experiencesZiqualo(magasin);
  await enregistrerJugement(magasin, pos1.id, 'incorrect'); // jugement défavorable sur un POSITIF...
  await enregistrerJugement(magasin, neg1.id, 'correct'); // ...et favorable sur un NÉGATIF : sans effet ici.

  await el.motifsLister.declencher('click');
  const m = el.motifsRapport.textContent.match(/— mot:ziqualo\s*\n\s*numéro : (\d+)/);
  el.motifsNumero.value = m[1];
  await el.motifsUtiliser.declencher('click');
  assert.equal(el.inductionPositifs.value, 'Ziqualo, ma teinte est jaune.\nZiqualo, mon bouloir est vert.');
  assert.equal(el.inductionNegatifs.value, 'Ma teinte est jaune.\nMon bouloir est vert.');
});

// -------------------------------------------------------------------- 10 — B1 jamais modifiée par ce raccord
test('[ROUGE] repérer un motif et le charger dans le banc d\'essai ne modifie jamais les expériences B1', async () => {
  const { el, magasin } = await monter();
  await experiencesZiqualo(magasin);
  const avant = JSON.stringify(await magasin.lireTout('experiences'));
  await el.motifsLister.declencher('click');
  const m = el.motifsRapport.textContent.match(/— mot:ziqualo\s*\n\s*numéro : (\d+)/);
  el.motifsNumero.value = m[1];
  await el.motifsUtiliser.declencher('click');
  const apres = JSON.stringify(await magasin.lireTout('experiences'));
  assert.equal(avant, apres);
});

// -------------------------------------------------------------------- 11 — STATIQUE : jamais un second moteur
test('[STATIQUE] le câblage « Utiliser ce motif » n\'appelle jamais induire() ni apprendreGabaritType()', () => {
  const debut = ecranJs.indexOf('bMotifsUtiliser.addEventListener');
  assert.ok(debut > 0);
  const finZone = ecranJs.indexOf('// === FORMATION ET PERSISTANCE', debut);
  const bloc = sansCommentaires(finZone > debut ? ecranJs.slice(debut, finZone) : ecranJs.slice(debut, debut + 2000));
  assert.ok(!bloc.includes('apprendreGabaritType'));
  const appelsInduire = bloc.match(/(?<![a-zA-Zé])induire\(/g) || [];
  assert.equal(appelsInduire.length, 0);
});

// -------------------------------------------------------------------- 12 — STATIQUE : jugements jamais lus par ce raccord
test('[STATIQUE] le câblage « Utiliser ce motif » ne lit jamais les jugements correct/incorrect', () => {
  const debut = ecranJs.indexOf('bMotifsUtiliser.addEventListener');
  const finZone = ecranJs.indexOf('// === FORMATION ET PERSISTANCE', debut);
  const bloc = sansCommentaires(ecranJs.slice(debut, finZone));
  assert.ok(!/jugement/i.test(bloc));
});
