// v0.17.1 — le panneau du laboratoire face à un conflit de faits : compteur, « Ce qu'elle sait »,
// « Gérer ce qu'elle sait ». Câblage RÉEL de app/langage/ecran.js (faux DOM minimal), vrai magasin,
// vrai moteur. Complète tests/ecrans-contrats.test.mjs (v0.15/0.16), qui garde le contrôle statique
// général des sélecteurs data-langage-… ; ce fichier se concentre sur le comportement des conflits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

class Faux {
  constructor(tag) {
    this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this.attrs = {};
    this._cls = new Set(); this.disabled = false; this.textContent = ''; this.value = ''; this.hidden = false;
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  async click() { for (const f of this.listeners.click || []) await f(); }
  querySelector() { return universel(); }
}
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;
const { monterEcranLangage } = await import('../app/langage/ecran.js');

function monter(magasin) {
  const el = {
    etat: new Faux('p'), fil: new Faux('div'), formulaire: new Faux('form'), question: new Faux('input'),
    savoir: new Faux('button'), gererTout: new Faux('button'), listeTout: new Faux('div'),
  };
  const zone = {
    querySelector: (sel) => {
      const m = sel.match(/^\[data-langage-([a-z-]+)\]$/);
      const cle = m && m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return (cle && el[cle]) || universel();
    },
  };
  const ecran = monterEcranLangage({ zone, ouvrirStockage: async () => magasin, confirmer: () => true, appelerGemini: null });
  return { el, ecran };
}

// Toutes les lignes texte affichées par « Gérer ce qu'elle sait » : chaque bloc est un <div> avec
// un <p> (le texte) et, s'il y a un retrait possible, un <button> « Oublier ».
function lignesGerer(listeTout) {
  return listeTout.children.map((bloc) => {
    if (bloc.tag === 'p') return { texte: bloc.children[0] ? bloc.children[0].textContent : bloc.textContent, titre: true };
    const p = bloc.children.find((c) => c.tag === 'p');
    const bouton = bloc.children.find((c) => c.tag === 'button');
    return { texte: p ? p.textContent : '', bouton };
  });
}

async function baseAvecConflit() {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('lexique', { mot: 'telephone', role: 'relation', relation: 'telephone' });
  await magasin.ecrire('faits', { cle: 'moi|téléphone', sujet: 'moi', relation: 'téléphone', valeur: 'un TCL' });
  await magasin.ecrire('faits', { cle: 'moi|telephone', sujet: 'moi', relation: 'telephone', valeur: 'un Samsung' });
  return magasin;
}

test('COMPTEUR — un conflit de faits est signalé, une base sans conflit ne dit rien de plus', async () => {
  const { el, ecran } = monter(await baseAvecConflit());
  await ecran.rafraichir();
  assert.match(el.etat.textContent, /faits/);
  assert.match(el.etat.textContent, /1 conflit de faits\./);

  const { el: el2, ecran: ecran2 } = monter(magasinMemoireVive());
  await ecran2.rafraichir();
  assert.doesNotMatch(el2.etat.textContent, /conflit/);
  assert.doesNotMatch(el2.etat.textContent, /ancienne graphie/);
});

test('« CE QU\'ELLE SAIT » — le conflit apparaît marqué, avec les deux valeurs, sans en choisir une', async () => {
  const { el, ecran } = monter(await baseAvecConflit());
  await el.savoir.click();
  const fil = el.fil.children.map((b) => (b.children[0] ? b.children[0].textContent : b.textContent)).join('\n');
  assert.match(fil, /moi → téléphone → \[CONFLIT : un TCL \/ un Samsung\]|moi → telephone → \[CONFLIT : un Samsung \/ un TCL\]/);
});

test('« GÉRER CE QU\'ELLE SAIT » — les deux lignes en conflit sont listées, chacune avec son propre Oublier', async () => {
  const magasin = await baseAvecConflit();
  const { el, ecran } = monter(magasin);
  await el.gererTout.click();
  const lignes = lignesGerer(el.listeTout);
  const conflits = lignes.filter((l) => l.texte && l.texte.startsWith('[CONFLIT]'));
  assert.equal(conflits.length, 2);
  assert.ok(conflits.some((l) => l.texte.includes('un TCL')));
  assert.ok(conflits.some((l) => l.texte.includes('un Samsung')));
  assert.ok(conflits.every((l) => l.bouton && l.bouton.textContent === 'Oublier'));

  // Oublier UNE des deux lignes : le conflit disparaît, l'autre valeur devient la réponse.
  const cible = conflits.find((l) => l.texte.includes('un TCL'));
  await cible.bouton.click();
  const dur = await ecran.assurerEsprit();
  const { repondre } = await import('../app/langage/esprit.js');
  assert.equal(repondre(dur, 'Quel est mon téléphone ?').texte, 'un Samsung');
  assert.equal((await magasin.lireTout('faits')).length, 1);
});

test('sans conflit : le comportement de « Gérer » est inchangé (une ligne, un Oublier simple)', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('lexique', { mot: 'couleur', role: 'relation', relation: 'couleur' });
  await magasin.ecrire('faits', { cle: 'moi|couleur', sujet: 'moi', relation: 'couleur', valeur: 'rouge' });
  const { el, ecran } = monter(magasin);
  await el.gererTout.click();
  const lignes = lignesGerer(el.listeTout).filter((l) => l.texte && l.texte.startsWith('moi → couleur →'));
  assert.equal(lignes.length, 1);
  assert.equal(lignes.filter((l) => l.texte.startsWith('[CONFLIT]')).length, 0);
});

// Élargi le 26/09/2026 (décision ChatGPT « SIGNAL D'APPRENTISSAGE », étape E) : voir
// tests/ecrans-contrats.test.mjs pour le contrat de référence désormais à cinq exports.
test('PANNEAU — les exports de monterEcranLangage restent exactement les cinq attendus', async () => {
  const { ecran } = monter(magasinMemoireVive());
  assert.deepEqual(Object.keys(ecran).sort(), ['assurerEsprit', 'ecrireConnaissance', 'jugerExperience', 'rafraichir', 'reconnaitreAttentesPourExperience']);
});
