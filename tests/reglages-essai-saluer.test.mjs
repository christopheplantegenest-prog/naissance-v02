// Réglages — section « Essai : saluer » (ticket-33, jalon reglages-essai-saluer).
// Section d'essai purement visuelle : un bouton « Saluer » affiche un salut éphémère juste en dessous.
// Rien n'est enregistré, aucun appel réseau, rien de cognitif.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Faux DOM minimal : juste ce que creerEssaiSaluer utilise.
class FauxElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributs = new Map();
    this.ecouteurs = new Map();
    this.className = '';
    this.hidden = false;
    this.type = '';
    this._texte = '';
  }
  get textContent() { return this._texte + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._texte = String(v); this.children = []; }
  setAttribute(n, v) { this.attributs.set(n, String(v)); }
  getAttribute(n) { return this.attributs.has(n) ? this.attributs.get(n) : null; }
  hasAttribute(n) { return this.attributs.has(n); }
  append(...enfants) { this.children.push(...enfants); }
  appendChild(e) { this.children.push(e); return e; }
  addEventListener(type, f) { if (!this.ecouteurs.has(type)) this.ecouteurs.set(type, []); this.ecouteurs.get(type).push(f); }
  click() { for (const f of this.ecouteurs.get('click') || []) f({ type: 'click', target: this }); }
}
globalThis.document = { createElement: (tag) => new FauxElement(tag) };

const { creerEssaiSaluer, TEXTE_SALUT } = await import('../app/reglages/ecran.js');

const SRC = readFileSync(new URL('../app/reglages/ecran.js', import.meta.url), 'utf8');

function parties(bloc) {
  const titre = bloc.children.find((e) => e.tagName === 'H3');
  const bouton = bloc.children.find((e) => e.tagName === 'BUTTON');
  const sortie = bloc.children.find((e) => e.tagName === 'P');
  return { titre, bouton, sortie };
}

test('creerEssaiSaluer rend un bloc avec un h3 « Essai : saluer », un bouton « Saluer » et une sortie cachée et vide', () => {
  const bloc = creerEssaiSaluer();
  assert.equal(bloc.tagName, 'DIV');
  assert.equal(bloc.className, 'bloc');
  assert.equal(bloc.hasAttribute('data-essai-saluer'), true);
  const { titre, bouton, sortie } = parties(bloc);
  assert.ok(titre, 'h3 présent');
  assert.equal(titre.textContent, 'Essai : saluer');
  assert.ok(bouton, 'bouton présent');
  assert.equal(bouton.textContent, 'Saluer');
  assert.equal(bouton.type, 'button');
  assert.equal(bouton.className, 'bouton-secondaire');
  assert.ok(sortie, 'paragraphe de sortie présent');
  assert.equal(sortie.className, 'aide');
  assert.equal(sortie.getAttribute('aria-live'), 'polite');
  assert.equal(sortie.hidden, true);
  assert.equal(sortie.textContent, '');
  // Ordre : titre, bouton, puis la sortie juste en dessous du bouton.
  assert.deepEqual(bloc.children.map((e) => e.tagName), ['H3', 'BUTTON', 'P']);
});

test('après click() sur « Saluer », la sortie est visible et vaut exactement « Bonjour, je suis Naissance. »', () => {
  const bloc = creerEssaiSaluer();
  const { bouton, sortie } = parties(bloc);
  bouton.click();
  assert.equal(sortie.hidden, false);
  assert.equal(sortie.textContent, 'Bonjour, je suis Naissance.');
  // Un second toucher ne duplique rien.
  bouton.click();
  assert.equal(sortie.textContent, 'Bonjour, je suis Naissance.');
});

test('chaque section est neuve : une nouvelle construction (rechargement) repart cachée et vide', () => {
  const premiere = creerEssaiSaluer();
  parties(premiere).bouton.click();
  const seconde = creerEssaiSaluer();
  const { sortie } = parties(seconde);
  assert.equal(sortie.hidden, true);
  assert.equal(sortie.textContent, '');
});

test('TEXTE_SALUT vaut exactement « Bonjour, je suis Naissance. »', () => {
  assert.equal(TEXTE_SALUT, 'Bonjour, je suis Naissance.');
});

// --- statique
const DEBUT = '// === DEBUT_ECRAN_REGLAGES ===';
const FIN = '// === FIN_ECRAN_REGLAGES ===';

function codeEssai() {
  const i = SRC.indexOf('export const TEXTE_SALUT');
  const j = SRC.indexOf(FIN);
  assert.ok(i > 0 && j > i, 'section essai trouvée avant le marqueur de fin');
  return SRC.slice(i, j);
}

function corpsMonterReglages() {
  const i = SRC.indexOf('export function monterReglages');
  const j = SRC.indexOf('\n}\n', i);
  assert.ok(i > 0 && j > i, 'monterReglages trouvé');
  return SRC.slice(i, j);
}

test('statique : le code de creerEssaiSaluer ne contient ni localStorage, ni indexedDB, ni fetch, ni XMLHttpRequest, ni modifierFournisseur, ni ecrire(', () => {
  const code = codeEssai();
  assert.ok(code.includes('export function creerEssaiSaluer'));
  for (const interdit of ['localStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'modifierFournisseur', 'ecrire(', 'sessionStorage', 'WebSocket']) {
    assert.equal(code.includes(interdit), false, `interdit : ${interdit}`);
  }
});

test('statique : monterReglages appelle compteur.after(creerEssaiSaluer()) une seule fois, entre les marqueurs', () => {
  const appel = 'compteur.after(creerEssaiSaluer())';
  assert.equal(SRC.split(appel).length, 2, 'un seul appel dans tout le fichier');
  assert.equal(corpsMonterReglages().split(appel).length, 2, 'appel dans monterReglages');
  assert.equal((SRC.match(/(?<!function )creerEssaiSaluer\(/g) || []).length, 1, 'creerEssaiSaluer appelée une seule fois');
  const d = SRC.indexOf(DEBUT);
  const f = SRC.indexOf(FIN);
  const a = SRC.indexOf(appel);
  const def = SRC.indexOf('export function creerEssaiSaluer');
  assert.ok(d >= 0 && d < a && a < f, 'appel entre les marqueurs');
  assert.ok(d < def && def < f, 'définition entre les marqueurs');
  assert.equal(SRC.split(DEBUT).length, 2);
  assert.equal(SRC.split(FIN).length, 2);
});
