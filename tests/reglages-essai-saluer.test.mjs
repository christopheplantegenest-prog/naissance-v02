// Réglages : section « Essai : saluer » (ticket-35). Le salut n'existe que dans le DOM :
// rien n'est enregistré, aucun appel réseau, un nouveau montage redonne un paragraphe vide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { monterReglages } from '../app/reglages/ecran.js';

const SALUT = 'Bonjour, je suis Naissance.';
const SOURCE = fs.readFileSync(new URL('../app/reglages/ecran.js', import.meta.url), 'utf8');

// --- Faux DOM minimal ---
class FauxElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributs = {};
    this.ecouteurs = {};
    this._texte = '';
    this.className = '';
    this.hidden = false;
    this.value = '';
    this.type = '';
    this.href = '';
    this.disabled = false;
    this.selectedIndex = -1;
  }
  get textContent() { return this._texte + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) {
    for (const c of this.children) c.parentNode = null;
    this.children = [];
    this._texte = String(v);
  }
  setAttribute(n, v) { this.attributs[n] = String(v); }
  getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attributs, n) ? this.attributs[n] : null; }
  hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attributs, n); }
  appendChild(e) {
    if (e.parentNode) e.parentNode.children = e.parentNode.children.filter((c) => c !== e);
    e.parentNode = this;
    this.children.push(e);
    return e;
  }
  append(...es) { for (const e of es) this.appendChild(e); }
  after(...es) {
    const parent = this.parentNode;
    let i = parent.children.indexOf(this);
    for (const e of es) {
      if (e.parentNode) e.parentNode.children = e.parentNode.children.filter((c) => c !== e);
      e.parentNode = parent;
      i += 1;
      parent.children.splice(i, 0, e);
    }
  }
  addEventListener(t, f) { (this.ecouteurs[t] ||= []).push(f); }
  click() { for (const f of this.ecouteurs.click || []) f({ type: 'click', target: this }); }
  querySelector(sel) {
    const m = /^\[([a-z-]+)\]$/.exec(sel);
    if (!m) throw new Error(`sélecteur non pris en charge : ${sel}`);
    for (const c of this.children) {
      if (c.hasAttribute(m[1])) return c;
      const trouve = c.querySelector(sel);
      if (trouve) return trouve;
    }
    return null;
  }
  get nombreDescendants() { return this.children.reduce((n, c) => n + 1 + c.nombreDescendants, 0); }
}

function element(tag, attribut) {
  const e = new FauxElement(tag);
  if (attribut) e.setAttribute(attribut, '');
  return e;
}

// Panneau neuf équivalent à la section Réglages d'index.html (l'élément après le compteur sert de repère).
function panneauNeuf() {
  const panneau = element('section');
  panneau.append(
    element('select', 'data-fournisseur'),
    element('input', 'data-cle'),
    element('button', 'data-voir-cle'),
    element('p', 'data-diagnostic'),
    element('button', 'data-tester'),
    element('button', 'data-effacer'),
    element('div', 'data-resultat'),
    element('label', 'data-zone-modele'),
    element('select', 'data-modele'),
    element('span', 'data-aide-cle'),
    element('a', 'data-lien-cle'),
    element('p', 'data-compteur'),
    element('div', 'data-zone-local'),
  );
  return panneau;
}

function stockageMemoire() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    get length() { return m.size; },
    instantane: () => JSON.stringify([...m.entries()].sort()),
  };
}

function installer() {
  const stockage = stockageMemoire();
  stockage.setItem('naissance-ia.reglages.v1', JSON.stringify({ fournisseur: 'gemini', parFournisseur: { gemini: { cle: 'AQ.cle-essai' } } }));
  Object.defineProperty(globalThis, 'localStorage', { value: stockage, configurable: true, writable: true });
  globalThis.document = { createElement: (tag) => new FauxElement(tag) };
  let appelsFetch = 0;
  const fetchAvant = globalThis.fetch;
  globalThis.fetch = async () => { appelsFetch += 1; throw new Error('aucun appel réseau attendu'); };
  return {
    stockage,
    appelsFetch: () => appelsFetch,
    restaurer: () => { globalThis.fetch = fetchAvant; },
  };
}

function monter() {
  const panneau = panneauNeuf();
  let changements = 0;
  monterReglages({ panneau, surChangement: () => { changements += 1; } });
  const compteur = panneau.querySelector('[data-compteur]');
  const zone = panneau.querySelector('[data-essai-saluer]');
  return { panneau, compteur, zone, changements: () => changements };
}

test('monterReglages crée, juste après [data-compteur], la zone data-essai-saluer : h3, bouton « Saluer », paragraphe vide', () => {
  const env = installer();
  try {
    const { panneau, compteur, zone } = monter();
    assert.ok(zone, 'zone data-essai-saluer absente');
    const i = panneau.children.indexOf(compteur);
    assert.equal(panneau.children[i + 1], zone);
    assert.equal(panneau.children[i + 2].hasAttribute('data-zone-local'), true);
    assert.equal(zone.tagName, 'DIV');
    assert.equal(zone.className, 'bloc');
    assert.equal(zone.children.length, 3);
    const [titre, bouton, paragraphe] = zone.children;
    assert.equal(titre.tagName, 'H3');
    assert.equal(titre.textContent, 'Essai : saluer');
    assert.equal(bouton.tagName, 'BUTTON');
    assert.equal(bouton.type, 'button');
    assert.equal(bouton.className, 'bouton-secondaire');
    assert.equal(bouton.textContent, 'Saluer');
    assert.equal(paragraphe.tagName, 'P');
    assert.equal(paragraphe.className, 'aide');
    assert.equal(paragraphe.getAttribute('aria-live'), 'polite');
    assert.equal(paragraphe.textContent, '');
  } finally { env.restaurer(); }
});

test('un clic sur « Saluer » affiche exactement le salut ; un second clic laisse le même texte, sans élément ajouté', () => {
  const env = installer();
  try {
    const { panneau, zone } = monter();
    const [, bouton, paragraphe] = zone.children;
    const avant = panneau.nombreDescendants;
    bouton.click();
    assert.equal(paragraphe.textContent, SALUT);
    assert.equal(paragraphe.children.length, 0);
    assert.equal(panneau.nombreDescendants, avant);
    bouton.click();
    assert.equal(paragraphe.textContent, SALUT);
    assert.equal(paragraphe.children.length, 0);
    assert.equal(zone.children.length, 3);
    assert.equal(panneau.nombreDescendants, avant);
  } finally { env.restaurer(); }
});

test('le clic ne modifie pas localStorage, n\'appelle pas surChangement et ne fait aucun fetch', () => {
  const env = installer();
  try {
    const { zone, changements } = monter();
    const avant = env.stockage.instantane();
    const changementsAvant = changements();
    zone.children[1].click();
    zone.children[1].click();
    assert.equal(env.stockage.instantane(), avant);
    assert.equal(changements(), changementsAvant);
    assert.equal(changements(), 0);
    assert.equal(env.appelsFetch(), 0);
  } finally { env.restaurer(); }
});

test('un second montage sur un panneau neuf (rechargement) redonne un paragraphe vide', () => {
  const env = installer();
  try {
    const premier = monter();
    premier.zone.children[1].click();
    assert.equal(premier.zone.children[2].textContent, SALUT);
    const second = monter();
    assert.notEqual(second.zone, premier.zone);
    assert.equal(second.zone.children[0].textContent, 'Essai : saluer');
    assert.equal(second.zone.children[1].textContent, 'Saluer');
    assert.equal(second.zone.children[2].textContent, '');
    assert.equal(env.stockage.instantane().includes(SALUT), false);
  } finally { env.restaurer(); }
});

test('[statique] les imports de app/reglages/ecran.js sont inchangés (8 lignes, aucune autre)', () => {
  const imports = SOURCE.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.deepEqual(imports, [
    "import { listerFournisseurs, obtenirFournisseur } from '../fournisseurs/registre.js';",
    "import { enErreurFournisseur } from '../fournisseurs/erreurs.js';",
    "import { lireReglages, reglagesDe, modifierFournisseur } from './stockage.js';",
    "import { nettoyerCle, longueur, resumeCle, caracteresInhabituels } from './cle.js';",
    "import { verifierModeles, nomCourt } from '../fournisseurs/fiabilite.js';",
    "import { lireSante, etatModele, estConfirme, estDisparu, estDisponible, quotaDuJourAtteint, repriseDe } from '../fournisseurs/sante.js';",
    "import { fetchCompte, lireCompteur, resumeCompteur } from '../fournisseurs/compteur.js';",
    "import { heureCourte } from '../fournisseurs/fiabilite.js';",
  ]);
  assert.equal(/\bimport\s*\(/.test(SOURCE), false);
});

test('[statique] le bloc de la section d\'essai ne contient ni fetch, ni stockage, ni écriture', () => {
  const debut = SOURCE.indexOf('// --- DEBUT_ESSAI_SALUER ---');
  const fin = SOURCE.indexOf('// --- FIN_ESSAI_SALUER ---');
  assert.ok(debut > 0 && fin > debut, 'bornes du bloc d\'essai introuvables');
  const bloc = SOURCE.slice(debut, fin);
  assert.match(bloc, /data-essai-saluer/);
  assert.match(bloc, /compteur\.after\(/);
  for (const interdit of [/fetch/i, /localStorage/i, /indexedDB/i, /sessionStorage/i, /\becrire\s*\(/, /modifierFournisseur/, /surChangement/]) {
    assert.equal(interdit.test(bloc), false, `mention interdite dans le bloc d'essai : ${interdit}`);
  }
});
