// v0.17 — le PANNEAU « Donner un cours » du laboratoire : câblage réel de app/langage/ecran.js sur le HTML réel
// de app/index.html (contrôle statique), et scénario complet avec les vrais gestionnaires d'événements
// (faux DOM minimal, vrai magasin mémoire, vrai moteur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VERSION } from '../app/version.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { instantane } from '../app/langage/cours.js';
import { extraireLecon } from '../app/langage/lecon.js';

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

const attendre = async (cond, ms = 3000) => {
  const debut = Date.now();
  while (!cond()) { if (Date.now() - debut > ms) throw new Error('délai dépassé'); await new Promise((r) => setTimeout(r, 2)); }
};

// ------------------------------------------------------------------------------------ STATIQUE
test('STATIQUE — chaque sélecteur data-langage-… utilisé par ecran.js existe dans index.html (sinon le laboratoire plante au montage)', () => {
  const utilises = new Set([...ecranJs.matchAll(/\$\('\[(data-langage-[a-z0-9-]+)\]'\)/g)].map((m) => m[1]));
  assert.ok(utilises.size > 30);
  const presents = new Set([...indexHtml.matchAll(/\b(data-langage-[a-z0-9-]+)/g)].map((m) => m[1]));
  for (const s of utilises) assert.ok(presents.has(s), `ecran.js cherche [${s}] mais index.html ne le contient pas`);
});

test('STATIQUE — le bloc « cours » : les huit éléments existent, sont tous utilisés, et Confirmer / Copier démarrent inactifs', () => {
  const attendus = ['texte', 'verifier', 'confirmer', 'tester', 'copier', 'etat', 'apercu', 'rapport'].map((n) => `data-langage-cours-${n}`);
  for (const a of attendus) {
    assert.ok(indexHtml.includes(a), `index.html : ${a} manquant`);
    assert.ok(ecranJs.includes(`$('[${a}]')`), `ecran.js n'utilise pas ${a}`);
  }
  const dansHtml = [...indexHtml.matchAll(/\b(data-langage-cours-[a-z]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(dansHtml)].sort(), [...attendus].sort(), 'aucun élément « cours » orphelin');
  assert.match(indexHtml, /<button[^>]*data-langage-cours-confirmer[^>]*\bdisabled\b/);
  assert.match(indexHtml, /<button[^>]*data-langage-cours-copier[^>]*\bdisabled\b/);
  assert.match(indexHtml, /<details data-langage-cours>/);
});

test('STATIQUE — le service worker précharge le nouveau module', () => {
  const sw = readFileSync(join(RACINE_APP, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'./langage/cours.js'"));
  assert.ok(sw.includes("'./langage/interpretation.js'"));
});

// ------------------------------------------------------------------------------------ SCÉNARIO
const COURS = `Leçon : mes objets
Source : Claude
Mot : livre désigne livre.
Propriété : livre / genre / masculin.
Mot : montre désigne montre.
Propriété : montre / genre / féminin.
Pour possessif_toi : si genre vaut féminin, on dit ta.
Décor : Fait : moi / livre / un roman.
Décor : Fait : moi / montre / une Casio.
Décor : Mot : contraire désigne contraire.
Décor : Fait : chaud / contraire / froid.
Exercice : Quel est mon livre ? => ton livre, c'est un roman.
Exercice : Quelle est ma montre ? => ta montre, c'est une Casio.
Exercice : Dis-moi quel est mon livre. => ton livre, c'est un roman.
Exercice : Quelle est ma bicyclette ? => Je n'ai pas compris.
Sonde : Quelle est la couleur de mon livre ?
Sonde : Quel est le contraire de chaud ?
`;

async function monter({ copier } = {}) {
  const magasin = magasinMemoireVive();
  const el = {
    texte: new Faux(), verifier: new Faux(), confirmer: new Faux(), tester: new Faux(), copier: new Faux(),
    etat: new Faux(), apercu: new Faux(), rapport: new Faux(),
  };
  el.confirmer.disabled = true; // comme dans index.html (attribut disabled)
  el.copier.disabled = true;
  el.apercu.hidden = true;
  el.rapport.hidden = true;
  const zone = {
    querySelector: (sel) => {
      const m = sel.match(/^\[data-langage-cours-([a-z]+)\]$/);
      return m ? el[m[1]] : universel();
    },
  };
  const copies = [];
  const ecran = monterEcranLangage({ zone, ouvrirStockage: async () => magasin, confirmer: () => true, copier: copier || (async (t) => { copies.push(t); }) });
  const esprit = await ecran.assurerEsprit();
  for (const l of [
    'Fait : moi / couleur / rouge.', 'Propriété : couleur / genre / féminin.',
    'Pour possessif_toi : si genre vaut masculin, on dit ton.', 'Pour possessif_toi : si genre vaut féminin, on dit ta.',
    "Façon de dire : * / moi / {possessif} {relation}, c'est {valeur}.",
  ]) await ecran.ecrireConnaissance(esprit, extraireLecon(l), { origine: 'test', exemple: l });
  return { el, ecran, esprit, magasin, copies };
}

test('PANNEAU — les exports de monterEcranLangage restent exactement les trois attendus', async () => {
  const { ecran } = await monter();
  assert.deepEqual(Object.keys(ecran).sort(), ['assurerEsprit', 'ecrireConnaissance', 'rafraichir']);
});

test('PANNEAU — scénario complet : Confirmer inactif, Vérifier n’écrit rien, modifier invalide, Confirmer donne VALIDÉE, Copier envoie le rapport', async () => {
  const { el, esprit, magasin, copies } = await monter();
  const avant = await instantane(magasin);

  // Confirmer avant Vérifier : le garde-fou du gestionnaire refuse (le bouton est aussi inactif dans la page).
  el.texte.value = COURS;
  await el.confirmer.declencher('click');
  assert.match(el.etat.textContent, /Vérifie d'abord le texte actuel/);
  assert.equal(await instantane(magasin), avant);
  assert.equal(esprit.lexique.livre, undefined);

  // Vérifier : aperçu chiffré, aucune écriture, Confirmer devient actif.
  await el.verifier.declencher('click');
  assert.equal(el.apercu.hidden, false);
  assert.match(el.apercu.textContent, /5 éléments d'enseignement : 4 nouveaux, 1 déjà connu, 0 remplacent/);
  assert.match(el.apercu.textContent, /Décor : 4 lignes \(temporaires, jamais écrites dans sa vraie mémoire\) · exercices : 4 · sondes : 2/);
  assert.match(el.apercu.textContent, /1\. \[nouveau\] Mot : livre désigne livre\./);
  assert.match(el.apercu.textContent, /5\. \[déjà connu \(sautée\)\] Pour possessif_toi/);
  assert.equal(el.confirmer.disabled, false);
  assert.equal(await instantane(magasin), avant, 'Vérifier n’a rien écrit');

  // Modifier le texte invalide la vérification.
  el.texte.value = `${COURS}# modifié`;
  await el.texte.declencher('input');
  assert.equal(el.confirmer.disabled, true);
  assert.match(el.etat.textContent, /Le texte a changé/);
  el.texte.value = COURS;
  await el.verifier.declencher('click');
  assert.equal(el.confirmer.disabled, false);

  // Confirmer la leçon : enseignement, exercices, rapport.
  await el.confirmer.declencher('click');
  assert.equal(el.rapport.hidden, false);
  assert.match(el.rapport.textContent, new RegExp(`RAPPORT DE COURS — Naissance v${VERSION.replaceAll('.', '\\.')}`));
  assert.match(el.rapport.textContent, /Verdict : VALIDÉE \(4\/4 exercices\)/);
  assert.match(el.rapport.textContent, /AMBIGUÏTÉ — AMBIGUITE/);
  assert.match(el.rapport.textContent, /MOTEUR — SUJET_NON_REPRESENTABLE/);
  assert.match(el.rapport.textContent, /vrai magasin inchangé pendant le Décor et les exercices : oui/);
  assert.match(el.etat.textContent, /Cours donné : VALIDÉE \(4\/4 exercices\)/);
  assert.equal(esprit.lexique.livre.relation, 'livre');
  assert.equal(esprit.faits.has('moi|livre'), false, 'le Décor n’est pas dans la vraie mémoire');
  assert.equal(el.confirmer.disabled, true, 'une seule confirmation par vérification');
  assert.equal(el.verifier.disabled, false);
  assert.equal(el.tester.disabled, false);
  assert.equal(el.copier.disabled, false);

  // Copier : exactement le rapport affiché.
  await el.copier.declencher('click');
  assert.deepEqual(copies, [el.rapport.textContent]);
  assert.match(el.etat.textContent, /Rapport copié/);
});

test('PANNEAU — « Tester seulement » n’écrit rien et donne le verdict sur l’état réel', async () => {
  const { el, esprit, magasin } = await monter();
  el.texte.value = COURS;
  const avant = await instantane(magasin);
  await el.tester.declencher('click');
  assert.equal(await instantane(magasin), avant);
  assert.equal(esprit.lexique.livre, undefined);
  assert.match(el.rapport.textContent, /Mode : TEST SEULEMENT/);
  assert.match(el.rapport.textContent, /Verdict : ÉCHOUÉE/, 'la leçon n’a pas été donnée : « livre » est inconnu');
  assert.match(el.rapport.textContent, /VOCABULAIRE/);
  assert.match(el.etat.textContent, /Test seulement \(rien n'est écrit\)/);
});

test('PANNEAU — un bloc refusé : numéros de ligne affichés, rien écrit, Confirmer reste inactif', async () => {
  const { el, magasin } = await monter();
  const avant = await instantane(magasin);
  el.texte.value = 'Mot livre désigne livre.\nExercice : Quel est mon livre ?';
  await el.verifier.declencher('click');
  assert.match(el.apercu.textContent, /ligne 1 : Ligne non reconnue/);
  assert.match(el.apercu.textContent, /ligne 2 : Un exercice s'écrit/);
  assert.equal(el.confirmer.disabled, true);
  assert.match(el.etat.textContent, /pas exécutable/);
  await el.tester.declencher('click');
  assert.match(el.rapport.textContent, /NON EXÉCUTÉ \(erreurs de lecture\)/);
  assert.equal(await instantane(magasin), avant);
});

test('PANNEAU — si la copie est impossible, le message le dit et le rapport reste sélectionnable', async () => {
  const { el } = await monter({ copier: async () => { throw new Error('refusé'); } });
  el.texte.value = COURS;
  await el.tester.declencher('click');
  await el.copier.declencher('click');
  assert.match(el.etat.textContent, /Copie impossible ici : sélectionne le texte du rapport/);
  assert.ok(el.rapport.textContent.length > 100);
});

test('PANNEAU — un problème technique est dit, jamais silencieux, et les boutons redeviennent utilisables', async () => {
  const { el } = await monter();
  el.texte.value = { toString() { throw new Error('boum'); } }; // la lecture du texte lève : le gestionnaire doit l'attraper
  await el.verifier.declencher('click');
  assert.match(el.etat.textContent, /Un problème technique m'a arrêtée : boum/);
  assert.equal(el.verifier.disabled, false);
  assert.equal(el.tester.disabled, false);
});
