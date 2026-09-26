// === DEBUT_TEST_EXPERIENCES_ECRAN ===
// Diagnostic provisoire (après B1+A1+A2) : « Voir les expériences » dans le laboratoire.
// LECTURE SEULE — ces tests prouvent qu'aucune écriture n'a lieu et que l'affichage reflète
// exactement ce que enregistrerExperience()/ajouterInterpretation() ont produit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

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

test('STATIQUE — les sélecteurs data-langage-experiences-… existent tous dans index.html', () => {
  for (const s of ['data-langage-experiences-lister', 'data-langage-experiences-etat', 'data-langage-experiences-rapport']) {
    assert.ok(indexHtml.includes(s), `index.html : ${s} manquant`);
    assert.ok(ecranJs.includes(`[${s}]`), `ecran.js n'utilise pas ${s}`);
  }
  assert.match(indexHtml, /<details data-langage-experiences>/);
});

test('STATIQUE — le bloc est bien marqué diagnostic/provisoire dans le HTML', () => {
  const bloc = indexHtml.slice(indexHtml.indexOf('data-langage-experiences>'), indexHtml.indexOf('data-langage-experiences>') + 700);
  assert.match(bloc, /diagnostic/i);
  assert.match(bloc, /LECTURE SEULE/i);
});

async function monter() {
  const magasin = magasinMemoireVive();
  const el = { lister: new Faux(), etat: new Faux(), rapport: new Faux() };
  el.rapport.hidden = true;
  const zone = {
    querySelector: (sel) => {
      const m = sel.match(/^\[data-langage-experiences-([a-z]+)\]$/);
      return m ? el[m[1]] : universel();
    },
  };
  const ecran = monterEcranLangage({ zone, ouvrirStockage: async () => magasin, confirmer: () => true });
  return { el, ecran, magasin };
}

test('scénario : aucune expérience → message explicite, rien caché en erreur', async () => {
  const { el } = await monter();
  await el.lister.declencher('click');
  assert.match(el.rapport.textContent, /Aucune expérience/);
  assert.equal(el.rapport.hidden, false);
  assert.match(el.etat.textContent, /0 expérience/);
});

test('scénario : une expérience avec une interprétation → tous les champs demandés visibles', async () => {
  const { el, magasin } = await monter();
  const date = new Date().toISOString();
  const exp = await enregistrerExperience(magasin, {
    texteRecu: 'Quel est mon manteau ?', texteRepondu: 'un manteau bleu.',
    date, source: 'laboratoire', referenceMemoire: { idQuestion: 41, idReponse: 99 },
  });
  await ajouterInterpretation(magasin, exp.id, { origine: 'comprendre', donnees: { etat: 'compris', type: 'QUESTION_INFORMATION' } });

  await el.lister.declencher('click');
  const t = el.rapport.textContent;
  assert.match(t, /Quel est mon manteau \?/);
  assert.match(t, /un manteau bleu\./);
  assert.match(t, /source : laboratoire/);
  assert.match(t, /idQuestion=41, idReponse=99/);
  assert.match(t, /origine=comprendre/);
  assert.match(t, /QUESTION_INFORMATION/);
  assert.match(el.etat.textContent, /1 expérience/);
});

test('lecture seule : lister() n\'écrit rien dans aucune table (avant/après identiques)', async () => {
  const { el, magasin } = await monter();
  await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
  });
  const avant = JSON.stringify(await magasin.lireTout('experiences'));
  await el.lister.declencher('click');
  const apres = JSON.stringify(await magasin.lireTout('experiences'));
  assert.equal(avant, apres);
  for (const t of ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes']) {
    assert.deepEqual(await magasin.lireTout(t), []);
  }
});

test('STATIQUE — ecran.js n\'appelle jamais ecrire(\'experiences\'...) depuis ce bloc de diagnostic', () => {
  const debut = ecranJs.indexOf("DIAGNOSTIC PROVISOIRE (B1)");
  const fin = ecranJs.indexOf('// Exposés pour le pont conversationnel');
  assert.ok(debut > 0 && fin > debut);
  const bloc = ecranJs.slice(debut, fin);
  assert.ok(!bloc.includes(".ecrire("));
  assert.ok(bloc.includes("lireTout('experiences')"));
});
// === FIN_TEST_EXPERIENCES_ECRAN ===
