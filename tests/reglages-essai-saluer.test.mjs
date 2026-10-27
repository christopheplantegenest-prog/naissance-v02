// Réglages : section « Essai : saluer » (bouton « Saluer », salut éphémère).
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
    this.textContent = '';
    this.hidden = false;
    this.type = '';
  }
  setAttribute(nom, valeur) { this.attributs.set(nom, String(valeur)); }
  getAttribute(nom) { return this.attributs.has(nom) ? this.attributs.get(nom) : null; }
  hasAttribute(nom) { return this.attributs.has(nom); }
  append(...enfants) { this.children.push(...enfants); }
  appendChild(enfant) { this.children.push(enfant); return enfant; }
  addEventListener(type, fn) {
    if (!this.ecouteurs.has(type)) this.ecouteurs.set(type, []);
    this.ecouteurs.get(type).push(fn);
  }
  click() { for (const fn of this.ecouteurs.get('click') || []) fn({ type: 'click', target: this }); }
}

globalThis.document = { createElement: (tag) => new FauxElement(tag) };

const { creerEssaiSaluer, TEXTE_SALUT } = await import('../app/reglages/ecran.js');

const SOURCE = readFileSync(new URL('../app/reglages/ecran.js', import.meta.url), 'utf8');

function parties(bloc) {
  const titre = bloc.children.find((e) => e.tagName === 'H3');
  const bouton = bloc.children.find((e) => e.tagName === 'BUTTON');
  const sortie = bloc.children.find((e) => e.tagName === 'P');
  return { titre, bouton, sortie };
}

test('TEXTE_SALUT vaut exactement « Bonjour, je suis Naissance. »', () => {
  assert.equal(TEXTE_SALUT, 'Bonjour, je suis Naissance.');
});

test('creerEssaiSaluer rend un bloc avec h3 « Essai : saluer », bouton « Saluer » et sortie cachée et vide', () => {
  const bloc = creerEssaiSaluer();
  assert.equal(bloc.tagName, 'DIV');
  assert.equal(bloc.className, 'bloc');
  assert.equal(bloc.hasAttribute('data-essai-saluer'), true);
  assert.equal(bloc.children.length, 3);
  const { titre, bouton, sortie } = parties(bloc);
  assert.equal(titre.textContent, 'Essai : saluer');
  assert.equal(bouton.textContent, 'Saluer');
  assert.equal(bouton.type, 'button');
  assert.equal(bouton.className, 'bouton-secondaire');
  assert.equal(sortie.className, 'aide');
  assert.equal(sortie.getAttribute('aria-live'), 'polite');
  assert.equal(sortie.hidden, true);
  assert.equal(sortie.textContent, '');
  // Ordre : titre, bouton, puis la sortie juste en dessous.
  assert.deepEqual(bloc.children, [titre, bouton, sortie]);
});

test('un clic sur « Saluer » affiche exactement « Bonjour, je suis Naissance. »', () => {
  const bloc = creerEssaiSaluer();
  const { bouton, sortie } = parties(bloc);
  bouton.click();
  assert.equal(sortie.hidden, false);
  assert.equal(sortie.textContent, 'Bonjour, je suis Naissance.');
  // Un second clic ne cumule rien.
  bouton.click();
  assert.equal(sortie.textContent, 'Bonjour, je suis Naissance.');
});

test('chaque section neuve repart cachée et vide (rien ne survit d’une construction à l’autre)', () => {
  const premiere = creerEssaiSaluer();
  parties(premiere).bouton.click();
  const neuve = parties(creerEssaiSaluer());
  assert.equal(neuve.sortie.hidden, true);
  assert.equal(neuve.sortie.textContent, '');
});

function codeDe(debut, fin) {
  const i = SOURCE.indexOf(debut);
  assert.notEqual(i, -1, `introuvable : ${debut}`);
  const j = SOURCE.indexOf(fin, i + debut.length);
  assert.notEqual(j, -1, `introuvable : ${fin}`);
  return SOURCE.slice(i, j);
}

test('statique : le code de creerEssaiSaluer n’écrit rien et n’appelle pas le réseau', () => {
  const code = codeDe('export function creerEssaiSaluer', '// === FIN_ECRAN_REGLAGES ===');
  for (const interdit of ['localStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'modifierFournisseur', 'ecrire(']) {
    assert.equal(code.includes(interdit), false, `interdit dans creerEssaiSaluer : ${interdit}`);
  }
});

test('statique : monterReglages appelle compteur.after(creerEssaiSaluer()) une seule fois, entre les marqueurs', () => {
  const appel = 'compteur.after(creerEssaiSaluer())';
  const occurrences = SOURCE.split(appel).length - 1;
  assert.equal(occurrences, 1);
  const monter = codeDe('export function monterReglages', 'export const TEXTE_SALUT');
  assert.equal(monter.split(appel).length - 1, 1);
  assert.equal(monter.split('creerEssaiSaluer(').length - 1, 1);
  const debut = SOURCE.indexOf('// === DEBUT_ECRAN_REGLAGES ===');
  const fin = SOURCE.indexOf('// === FIN_ECRAN_REGLAGES ===');
  const position = SOURCE.indexOf(appel);
  assert.ok(debut !== -1 && fin !== -1 && debut < position && position < fin);
  // Appelé en fin de montage : après le premier rafraîchissement, avant le retour.
  assert.ok(monter.lastIndexOf('rafraichir();') < monter.indexOf(appel));
  assert.ok(monter.indexOf(appel) < monter.indexOf('return { rafraichir }'));
});
