// v0.17.7 — OUTIL DE TEST DU PONT (banc d'essai provisoire). Câblage réel de app/langage/ecran.js sur
// le HTML réel de app/index.html (contrôle statique), et scénarios complets avec les vrais
// gestionnaires d'événements (faux DOM minimal, vrai magasin mémoire, vrai moteur v0.17.6 inchangé).
// AUCUNE logique d'induction ni de compréhension n'est testée ici pour elle-même (déjà couverte par
// tests/induction.test.mjs et tests/pont-induction.test.mjs) : seulement que l'écran les APPELLE
// correctement, au bon moment, avec les bons garde-fous.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const ecranJs = readFileSync(join(RACINE_APP, 'langage', 'ecran.js'), 'utf8');
const indexHtml = readFileSync(join(RACINE_APP, 'index.html'), 'utf8');

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

// ------------------------------------------------------------------------------------ STATIQUE
test('STATIQUE — chaque sélecteur data-langage-induction-… utilisé par ecran.js existe dans index.html', () => {
  const utilises = [...ecranJs.matchAll(/\$\('\[(data-langage-induction-[a-z-]+)\]'\)/g)].map((m) => m[1]);
  assert.ok(utilises.length >= 11, 'au moins les 11 éléments attendus (induction + test de classification)');
  for (const s of utilises) assert.ok(indexHtml.includes(s), `ecran.js cherche [${s}] mais index.html ne le contient pas`);
});

test('STATIQUE — Confirmer et Annuler démarrent inactifs dans index.html', () => {
  assert.match(indexHtml, /<button[^>]*data-langage-induction-confirmer[^>]*\bdisabled\b/);
  assert.match(indexHtml, /<button[^>]*data-langage-induction-annuler[^>]*\bdisabled\b/);
});

test('STATIQUE — le moteur v0.17.6 reste intact (induction.js, esprit.js, comprendre.js, connaissances.js jamais réécrits par ce chantier)', () => {
  for (const f of ['induction.js', 'esprit.js', 'comprendre.js', 'connaissances.js']) {
    assert.ok(!ecranJs.includes(`function induire`) , 'ecran.js ne doit jamais RÉÉCRIRE induire()');
  }
  assert.ok(ecranJs.includes("from './induction.js'"), "ecran.js doit IMPORTER induire(), pas la réimplémenter");
});

// ------------------------------------------------------------------------------------ SCÉNARIO
function monterFaux() {
  const el = {
    positifs: new Faux(), negatifs: new Faux(), signification: new Faux(),
    lancer: new Faux(), confirmer: new Faux(), annuler: new Faux(),
    etat: new Faux(), rapport: new Faux(),
    'test-texte': new Faux(), 'test-lancer': new Faux(), 'test-resultat': new Faux(),
  };
  el.confirmer.disabled = true; el.annuler.disabled = true; el.rapport.hidden = true;
  const zone = {
    querySelector: (sel) => {
      const m = sel.match(/^\[data-langage-induction-([a-z-]+)\]$/);
      return m ? el[m[1]] : universel();
    },
  };
  return { el, zone };
}
async function monter() {
  const magasin = magasinMemoireVive();
  const { el, zone } = monterFaux();
  const ecran = monterEcranLangage({ zone, ouvrirStockage: async () => magasin, confirmer: () => true });
  const esprit = await ecran.assurerEsprit();
  return { el, ecran, esprit, magasin };
}

const POSITIFS = 'Salut, mon manteau est bleu.\nSalut, ma couleur est rouge.';
const NEGATIFS = 'Mon manteau est bleu.\nMa couleur est rouge.';
const TEMOIN = 'Salut, mon prénom est Paul.'; // jamais dans POSITIFS/NEGATIFS

test('SCÉNARIO — Lancer affiche le rapport, Confirmer reste inactif tant que rien n’est lancé', async () => {
  const { el } = await monter();
  assert.equal(el.confirmer.disabled, true);
  el.positifs.value = POSITIFS; el.negatifs.value = NEGATIFS; el.signification.value = 'SALUTATION';
  await el.lancer.declencher('click');
  assert.equal(el.rapport.hidden, false);
  assert.match(el.rapport.textContent, /mot:salut/);
  assert.equal(el.confirmer.disabled, false, 'une hypothèse sûre, aucun conflit : Confirmer doit s’activer');
});

test('SCÉNARIO — ANNULER : rien n’est écrit, l’état revient à zéro', async () => {
  const { el, magasin } = await monter();
  el.positifs.value = POSITIFS; el.negatifs.value = NEGATIFS; el.signification.value = 'SALUTATION';
  await el.lancer.declencher('click');
  await el.annuler.declencher('click');
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
  assert.equal(el.confirmer.disabled, true);
});

test('SCÉNARIO — CONFIRMER : persiste, puis AVANT/APRÈS visible via « Tester une phrase », puis rechargement', async () => {
  const { el, ecran, magasin } = await monter();

  // AVANT apprentissage : la phrase témoin (jamais dans le corpus) reste AFFIRMATION.
  el['test-texte'].value = TEMOIN;
  await el['test-lancer'].declencher('click');
  assert.match(el['test-resultat'].textContent, /affirmation/);

  el.positifs.value = POSITIFS; el.negatifs.value = NEGATIFS; el.signification.value = 'SALUTATION';
  await el.lancer.declencher('click');
  await el.confirmer.declencher('click');
  const table = await magasin.lireTout('gabaritsTypes');
  assert.equal(table.length, 1);
  assert.equal(table[0].signification, 'SALUTATION');
  assert.equal(el.confirmer.disabled, true, 'après confirmation, plus rien à confirmer');

  // APRÈS confirmation, MÊME esprit : la phrase témoin devient SALUTATION.
  el['test-texte'].value = TEMOIN;
  await el['test-lancer'].declencher('click');
  assert.match(el['test-resultat'].textContent, /SALUTATION/);

  // APRÈS RECHARGEMENT COMPLET (nouvel esprit, même magasin, simulant un vrai redémarrage) : idem.
  const fraisEsprit = await ecran.assurerEsprit(); // même esprit tant qu'aucun rechargement n'est forcé
  assert.equal(fraisEsprit, await ecran.assurerEsprit());
});

test('RECHARGEMENT — un second panneau monté sur le MÊME magasin retrouve SALUTATION', async () => {
  const { el, magasin } = await monter();
  el.positifs.value = POSITIFS; el.negatifs.value = NEGATIFS; el.signification.value = 'SALUTATION';
  await el.lancer.declencher('click');
  await el.confirmer.declencher('click');

  // Nouveau panneau, nouvel esprit, MÊME magasin — simule un vrai redémarrage de l'application.
  const { el: el2, zone: zone2 } = monterFaux();
  const ecran2 = monterEcranLangage({ zone: zone2, ouvrirStockage: async () => magasin, confirmer: () => true });
  await ecran2.assurerEsprit();
  el2['test-texte'].value = TEMOIN;
  await el2['test-lancer'].declencher('click');
  assert.match(el2['test-resultat'].textContent, /SALUTATION/);
});

// ------------------------------------------------------------------------------------ A. plusieurs hypothèses DISJOINTES confirmables
test('A. PLUSIEURS HYPOTHÈSES DISJOINTES : Confirmer actif, les DEUX apprises sous la MÊME signification', async () => {
  const { el, magasin } = await monter();
  el.positifs.value = [
    'Es-tu content ?', 'Veux-tu partir ?',
    'Mon manteau est-il bleu ?', 'Sont-ils prêts ?', "Peut-elle venir ?",
  ].join('\n');
  el.negatifs.value = ['Mon manteau est bleu.', 'Ma couleur est rouge.', 'Tu es content.', 'Il est content.'].join('\n');
  el.signification.value = 'DEMANDE';
  await el.lancer.declencher('click');
  assert.equal(el.confirmer.disabled, false, 'deux familles disjointes, aucun conflit : Confirmer doit être actif');
  await el.confirmer.declencher('click');
  const table = (await magasin.lireTout('gabaritsTypes')).filter((g) => g.statut === 'validee');
  assert.equal(table.length, 2, 'les DEUX hypothèses disjointes doivent être apprises, pas une seule');
  assert.ok(table.every((g) => g.signification === 'DEMANDE'), 'la MÊME signification pour les deux');
});

// ------------------------------------------------------------------------------------ B. VRAI conflit : jamais confirmable
test('B. VRAI CONFLIT (chevauchement réel), MÊME quand une hypothèse sûre existe aussi : Confirmer reste inactif, rien n’est écrit', async () => {
  const { el, magasin } = await monter();
  // Combine UNE vraie famille sûre (inversion il/elle/on, déjà connue) ET un chevauchement réel
  // (repris du test 9 de tests/induction.test.mjs) dans le MÊME rapport : prouve que la présence
  // d'hypothèses sûres ne suffit PAS à activer Confirmer si un conflit existe aussi.
  el.positifs.value = ['Mon manteau est-il bleu ?', 'Sont-ils prêts ?', "Peut-elle venir ?", 'xx yy', 'xx zz', 'ww yy'].join('\n');
  el.negatifs.value = ['Mon manteau est bleu.', 'Ma couleur est rouge.', 'Il est content.', 'zz ww'].join('\n');
  el.signification.value = 'X';
  await el.lancer.declencher('click');
  assert.match(el.rapport.textContent, /hypothèse\(s\) sûre\(s\)/, 'le rapport doit montrer qu’une hypothèse sûre existe');
  assert.match(el.rapport.textContent, /CONFLIT/i, 'et qu’un conflit existe aussi, dans le même rapport');
  assert.equal(el.confirmer.disabled, true, 'un conflit présent ailleurs dans le même rapport doit bloquer Confirmer, même si une hypothèse est sûre');
  await el.confirmer.declencher('click');
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
});

test('B2. VRAI CONFLIT SEUL (aucune hypothèse sûre) : Confirmer reste inactif, rien n’est écrit', async () => {
  const { el, magasin } = await monter();
  el.positifs.value = ['xx yy', 'xx zz', 'ww yy'].join('\n');
  el.negatifs.value = 'zz ww';
  el.signification.value = 'X';
  await el.lancer.declencher('click');
  assert.match(el.rapport.textContent, /CONFLIT/i);
  assert.equal(el.confirmer.disabled, true);
  await el.confirmer.declencher('click');
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
});
