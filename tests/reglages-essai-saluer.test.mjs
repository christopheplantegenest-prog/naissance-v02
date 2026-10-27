// Réglages : section « Essai : saluer » (bouton « Saluer », salut éphémère).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Faux DOM minimal : juste ce que creerEssaiSaluer utilise.
class FauxElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributs = {};
    this.ecouteurs = {};
    this.textContent = '';
    this.className = '';
    this.hidden = false;
    this.type = '';
  }
  setAttribute(nom, valeur) { this.attributs[nom] = String(valeur); }
  getAttribute(nom) { return Object.prototype.hasOwnProperty.call(this.attributs, nom) ? this.attributs[nom] : null; }
  hasAttribute(nom) { return Object.prototype.hasOwnProperty.call(this.attributs, nom); }
  append(...enfants) { this.children.push(...enfants); }
  appendChild(enfant) { this.children.push(enfant); return enfant; }
  addEventListener(type, fn) { (this.ecouteurs[type] ||= []).push(fn); }
  click() { for (const fn of this.ecouteurs.click || []) fn({ type: 'click', target: this }); }
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

test('creerEssaiSaluer rend un h3 « Essai : saluer », un bouton « Saluer » et une sortie cachée et vide', () => {
  const bloc = creerEssaiSaluer();
  assert.equal(bloc.tagName, 'DIV');
  assert.equal(bloc.className, 'bloc');
  assert.equal(bloc.hasAttribute('data-essai-saluer'), true);
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
  const { bouton, sortie } = parties(creerEssaiSaluer());
  bouton.click();
  assert.equal(sortie.hidden, false);
  assert.equal(sortie.textContent, 'Bonjour, je suis Naissance.');
});

test('chaque section neuve repart cachée et vide (rien n’est retenu)', () => {
  parties(creerEssaiSaluer()).bouton.click();
  const { sortie } = parties(creerEssaiSaluer());
  assert.equal(sortie.hidden, true);
  assert.equal(sortie.textContent, '');
});

test('TEXTE_SALUT vaut exactement « Bonjour, je suis Naissance. »', () => {
  assert.equal(TEXTE_SALUT, 'Bonjour, je suis Naissance.');
});

test('statique : creerEssaiSaluer n’écrit rien et n’appelle pas le réseau', () => {
  const debut = SOURCE.indexOf('export function creerEssaiSaluer(');
  assert.ok(debut > 0, 'creerEssaiSaluer introuvable');
  const fin = SOURCE.indexOf('\n}\n', debut);
  assert.ok(fin > debut);
  const code = SOURCE.slice(debut, fin + 2);
  for (const interdit of ['localStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'modifierFournisseur', 'ecrire(']) {
    assert.equal(code.includes(interdit), false, `interdit dans creerEssaiSaluer : ${interdit}`);
  }
});

test('statique : monterReglages appelle compteur.after(creerEssaiSaluer()) une seule fois, entre les marqueurs', () => {
  const debutMarqueur = SOURCE.indexOf('// === DEBUT_ECRAN_REGLAGES ===');
  const finMarqueur = SOURCE.indexOf('// === FIN_ECRAN_REGLAGES ===');
  assert.ok(debutMarqueur >= 0 && finMarqueur > debutMarqueur);
  const debut = SOURCE.indexOf('export function monterReglages(');
  const fin = SOURCE.indexOf('\n}\n', debut);
  assert.ok(debut > debutMarqueur && fin > debut && fin < finMarqueur);
  const corps = SOURCE.slice(debut, fin);
  assert.equal(corps.split('compteur.after(creerEssaiSaluer())').length - 1, 1);
  assert.equal(SOURCE.split('compteur.after(').length - 1, 1);
  const defSalut = SOURCE.indexOf('export function creerEssaiSaluer(');
  assert.ok(defSalut > debutMarqueur && defSalut < finMarqueur);
});
