// Section « Mes tâches » des Réglages (ticket-37, jalon taches-reglages) : app/taches/ecran.js monté après
// [data-zone-local]. Faux DOM minimal, stockage en mémoire injecté. Aucun réseau, aucune mémoire de Naissance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { monterTaches } from '../app/taches/ecran.js';
import { monterReglages } from '../app/reglages/ecran.js';
import { CLE_TACHES, lireTaches, ajouterTache } from '../app/taches/taches.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ECRAN = readFileSync(join(RACINE, 'app', 'taches', 'ecran.js'), 'utf8');
const SOURCE_REGLAGES = readFileSync(join(RACINE, 'app', 'reglages', 'ecran.js'), 'utf8');

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
    this.placeholder = '';
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
  emettre(type) {
    const evenement = { type, target: this, defautEmpeche: false, preventDefault() { this.defautEmpeche = true; } };
    for (const f of this.ecouteurs[type] || []) f(evenement);
    return evenement;
  }
  click() {
    this.emettre('click');
    if (this.tagName === 'BUTTON' && this.type === 'submit') {
      let p = this.parentNode;
      while (p && p.tagName !== 'FORM') p = p.parentNode;
      if (p) p.emettre('submit');
    }
  }
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
}

function element(tag, attribut) {
  const e = new FauxElement(tag);
  if (attribut) e.setAttribute(attribut, '');
  return e;
}

function stockageMemoire() {
  const m = new Map();
  const s = {
    ecritures: 0,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { s.ecritures += 1; m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    get length() { return m.size; },
    instantane: () => JSON.stringify([...m.entries()].sort()),
  };
  return s;
}

function stockageEnPanne() {
  return {
    getItem: () => null,
    setItem: () => { throw new Error('stockage plein'); },
  };
}

function installerDocument() {
  globalThis.document = { createElement: (tag) => new FauxElement(tag) };
}

// Panneau minimal : une ancre suivie d'un voisin, pour vérifier l'insertion « juste après ».
function panneauAvecAncre() {
  const panneau = element('section');
  const ancre = element('div', 'data-ancre');
  const voisin = element('div', 'data-voisin');
  panneau.append(ancre, voisin);
  return { panneau, ancre, voisin };
}

function monter(stockage) {
  installerDocument();
  const { panneau, ancre, voisin } = panneauAvecAncre();
  const r = monterTaches({ apres: ancre, stockage });
  const [titre, formulaire, message, liste] = r.zone.children;
  const [champ, bouton] = formulaire.children;
  return { panneau, ancre, voisin, ...r, titre, formulaire, message, liste, champ, bouton };
}

function soumettre(formulaire) { return formulaire.emettre('submit'); }

test('monterTaches insère après l\'ancre une div.bloc data-taches : h3, form, p.aide vide, ul « Aucune tâche pour le moment. »', () => {
  const s = stockageMemoire();
  const m = monter(s);
  const i = m.panneau.children.indexOf(m.ancre);
  assert.equal(m.panneau.children[i + 1], m.zone);
  assert.equal(m.panneau.children[i + 2], m.voisin);
  assert.equal(m.zone.tagName, 'DIV');
  assert.equal(m.zone.className, 'bloc');
  assert.equal(m.zone.hasAttribute('data-taches'), true);
  assert.equal(m.zone.children.length, 4);
  assert.equal(m.titre.tagName, 'H3');
  assert.equal(m.titre.textContent, 'Mes tâches');
  assert.equal(m.formulaire.tagName, 'FORM');
  assert.equal(m.formulaire.children.length, 2);
  assert.equal(m.champ.tagName, 'INPUT');
  assert.equal(m.champ.type, 'text');
  assert.equal(m.champ.placeholder, 'Nouvelle tâche');
  assert.equal(m.champ.getAttribute('aria-label'), 'Nouvelle tâche');
  assert.equal(m.champ.getAttribute('autocomplete'), 'off');
  assert.equal(m.bouton.tagName, 'BUTTON');
  assert.equal(m.bouton.type, 'submit');
  assert.equal(m.bouton.className, 'bouton-principal');
  assert.equal(m.bouton.textContent, 'Ajouter la tâche');
  assert.equal(m.message.tagName, 'P');
  assert.equal(m.message.className, 'aide');
  assert.equal(m.message.getAttribute('aria-live'), 'polite');
  assert.equal(m.message.textContent, '');
  assert.equal(m.liste.tagName, 'UL');
  assert.equal(m.liste.hasAttribute('data-taches-liste'), true);
  assert.equal(m.liste.children.length, 1);
  assert.equal(m.liste.children[0].tagName, 'LI');
  assert.equal(m.liste.children[0].textContent, 'Aucune tâche pour le moment.');
  assert.equal(typeof m.rafraichir, 'function');
  assert.equal(s.ecritures, 0, 'le montage seul n\'écrit rien');
});

test('saisir « Acheter du pain » puis submit : preventDefault, champ vidé, li avec span et bouton « Terminer », tâche enregistrée', () => {
  const s = stockageMemoire();
  const m = monter(s);
  m.champ.value = 'Acheter du pain';
  const evenement = soumettre(m.formulaire);
  assert.equal(evenement.defautEmpeche, true);
  assert.equal(m.champ.value, '');
  assert.equal(m.message.textContent, '');
  assert.equal(m.liste.children.length, 1);
  const li = m.liste.children[0];
  assert.equal(li.tagName, 'LI');
  assert.equal(li.children.length, 2);
  const [span, terminer] = li.children;
  assert.equal(span.tagName, 'SPAN');
  assert.equal(span.textContent, 'Acheter du pain');
  assert.equal(terminer.tagName, 'BUTTON');
  assert.equal(terminer.type, 'button');
  assert.equal(terminer.className, 'bouton-secondaire');
  assert.equal(terminer.textContent, 'Terminer');
  assert.deepEqual(lireTaches(s), [{ id: 1, texte: 'Acheter du pain', terminee: false }]);
  assert.equal(JSON.parse(s.getItem(CLE_TACHES)).taches.length, 1);
});

test('le bouton « Ajouter la tâche » déclenche le même envoi du formulaire', () => {
  const s = stockageMemoire();
  const m = monter(s);
  m.champ.value = 'Arroser les plantes';
  m.bouton.click();
  assert.equal(m.champ.value, '');
  assert.equal(m.liste.children[0].children[0].textContent, 'Arroser les plantes');
  assert.deepEqual(lireTaches(s), [{ id: 1, texte: 'Arroser les plantes', terminee: false }]);
});

test('submit avec champ vide ou espaces : message « Écris d\'abord le texte de la tâche. », stockage inchangé', () => {
  const s = stockageMemoire();
  const m = monter(s);
  for (const saisie of ['', '   ']) {
    const avant = s.instantane();
    m.champ.value = saisie;
    const evenement = soumettre(m.formulaire);
    assert.equal(evenement.defautEmpeche, true);
    assert.equal(m.message.textContent, 'Écris d\'abord le texte de la tâche.');
    assert.equal(s.instantane(), avant);
    assert.equal(s.ecritures, 0);
    assert.equal(m.liste.children.length, 1);
    assert.equal(m.liste.children[0].textContent, 'Aucune tâche pour le moment.');
  }
  m.champ.value = 'Acheter du pain';
  soumettre(m.formulaire);
  assert.equal(m.message.textContent, '');
});

test('échec d\'écriture : message « Impossible d\'enregistrer sur cet appareil. », champ conservé', () => {
  const m = monter(stockageEnPanne());
  m.champ.value = 'Acheter du pain';
  soumettre(m.formulaire);
  assert.equal(m.message.textContent, 'Impossible d\'enregistrer sur cet appareil.');
  assert.equal(m.champ.value, 'Acheter du pain');
  assert.equal(m.liste.children[0].textContent, 'Aucune tâche pour le moment.');
});

test('clic « Terminer » : li au texte exact « Acheter du pain — terminée », sans bouton ; avec deux tâches, seule la visée change', () => {
  const s = stockageMemoire();
  const m = monter(s);
  m.champ.value = 'Acheter du pain';
  soumettre(m.formulaire);
  m.champ.value = 'Appeler le médecin';
  soumettre(m.formulaire);
  assert.equal(m.liste.children.length, 2);
  m.liste.children[0].children[1].click();
  assert.equal(m.liste.children.length, 2);
  const [premiere, seconde] = m.liste.children;
  assert.equal(premiere.textContent, 'Acheter du pain — terminée');
  assert.equal(premiere.children.length, 0);
  assert.equal(seconde.children.length, 2);
  assert.equal(seconde.children[0].textContent, 'Appeler le médecin');
  assert.equal(seconde.children[1].textContent, 'Terminer');
  assert.deepEqual(lireTaches(s), [
    { id: 1, texte: 'Acheter du pain', terminee: true },
    { id: 2, texte: 'Appeler le médecin', terminee: false },
  ]);
});

test('un second montage sur un panneau neuf avec le même stockage réaffiche les tâches et leur état (rechargement)', () => {
  const s = stockageMemoire();
  const premier = monter(s);
  premier.champ.value = 'Acheter du pain';
  soumettre(premier.formulaire);
  premier.champ.value = 'Appeler le médecin';
  soumettre(premier.formulaire);

  const deuxieme = monter(s);
  assert.notEqual(deuxieme.zone, premier.zone);
  assert.equal(deuxieme.liste.children.length, 2);
  assert.equal(deuxieme.liste.children[0].children[0].textContent, 'Acheter du pain');
  assert.equal(deuxieme.liste.children[0].children[1].textContent, 'Terminer');
  deuxieme.liste.children[0].children[1].click();

  const ecrituresAvant = s.ecritures;
  const troisieme = monter(s);
  assert.equal(s.ecritures, ecrituresAvant, 'le montage seul n\'écrit rien');
  assert.equal(troisieme.liste.children.length, 2);
  assert.equal(troisieme.liste.children[0].textContent, 'Acheter du pain — terminée');
  assert.equal(troisieme.liste.children[0].children.length, 0);
  assert.equal(troisieme.liste.children[1].children[0].textContent, 'Appeler le médecin');
  assert.equal(troisieme.liste.children[1].children[1].textContent, 'Terminer');
});

test('rafraichir relit le stockage', () => {
  const s = stockageMemoire();
  const m = monter(s);
  ajouterTache('Acheter du pain', s);
  assert.equal(m.liste.children[0].textContent, 'Aucune tâche pour le moment.');
  m.rafraichir();
  assert.equal(m.liste.children[0].children[0].textContent, 'Acheter du pain');
});

// --- Avec monterReglages et le faux panneau des Réglages ---
function panneauReglages() {
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
    element('div', 'data-zone-voix'),
  );
  return panneau;
}

test('avec monterReglages : la zone data-taches suit [data-zone-local], l\'essai reste après [data-compteur] ; le montage ne modifie pas le stockage', () => {
  const stockage = stockageMemoire();
  stockage.setItem('naissance-ia.reglages.v1', JSON.stringify({ fournisseur: 'gemini', parFournisseur: { gemini: { cle: 'AQ.cle-essai' } } }));
  ajouterTache('Acheter du pain', stockage);
  const localAvant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: stockage, configurable: true, writable: true });
  installerDocument();
  let appelsFetch = 0;
  const fetchAvant = globalThis.fetch;
  globalThis.fetch = async () => { appelsFetch += 1; throw new Error('aucun appel réseau attendu'); };
  try {
    const avant = stockage.instantane();
    const ecrituresAvant = stockage.ecritures;
    const panneau = panneauReglages();
    let changements = 0;
    monterReglages({ panneau, surChangement: () => { changements += 1; } });
    const compteur = panneau.querySelector('[data-compteur]');
    const essai = panneau.querySelector('[data-essai-saluer]');
    const local = panneau.querySelector('[data-zone-local]');
    const zone = panneau.querySelector('[data-taches]');
    assert.ok(zone, 'zone data-taches absente');
    const i = panneau.children.indexOf(compteur);
    assert.equal(panneau.children[i + 1], essai);
    assert.equal(panneau.children[i + 2], local);
    assert.equal(panneau.children[i + 3], zone);
    assert.equal(panneau.children[i + 4].hasAttribute('data-zone-voix'), true);
    assert.equal(zone.children[0].textContent, 'Mes tâches');
    const liste = zone.querySelector('[data-taches-liste]');
    assert.equal(liste.children[0].children[0].textContent, 'Acheter du pain');
    assert.equal(stockage.instantane(), avant);
    assert.equal(stockage.ecritures, ecrituresAvant);

    liste.children[0].children[1].click();
    assert.equal(liste.children[0].textContent, 'Acheter du pain — terminée');
    assert.equal(changements, 0, 'surChangement n\'est jamais appelé par la section');
    assert.equal(appelsFetch, 0);
  } finally {
    globalThis.fetch = fetchAvant;
    if (localAvant) Object.defineProperty(globalThis, 'localStorage', localAvant);
    else delete globalThis.localStorage;
  }
});

test('[statique] app/taches/ecran.js n\'importe que ./taches.js et ne mentionne ni fetch, ni indexedDB, ni sessionStorage, ni localStorage', () => {
  const imports = SOURCE_ECRAN.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.deepEqual(imports, ["import { lireTaches, ajouterTache, terminerTache } from './taches.js';"]);
  assert.equal(/\bimport\s*\(/.test(SOURCE_ECRAN), false);
  assert.equal(/\brequire\s*\(/.test(SOURCE_ECRAN), false);
  for (const interdit of [/fetch/i, /indexedDB/i, /sessionStorage/i, /localStorage/i, /XMLHttpRequest/, /memoire\//, /atelier/i]) {
    assert.equal(interdit.test(SOURCE_ECRAN), false, `mention interdite : ${interdit}`);
  }
  assert.match(SOURCE_ECRAN, /export function monterTaches\(\{ apres, stockage \}\)/);
  assert.match(SOURCE_ECRAN, /apres\.after\(zone\)/);
});

test('[statique] le bloc DEBUT_TACHES/FIN_TACHES de app/reglages/ecran.js appelle monterTaches, après FIN_ESSAI_SALUER, sans fetch, localStorage ni surChangement', () => {
  const finEssai = SOURCE_REGLAGES.indexOf('// --- FIN_ESSAI_SALUER ---');
  const debut = SOURCE_REGLAGES.indexOf('// --- DEBUT_TACHES ---');
  const fin = SOURCE_REGLAGES.indexOf('// --- FIN_TACHES ---');
  assert.ok(finEssai > 0 && debut > finEssai && fin > debut, 'bornes du bloc des tâches introuvables ou mal placées');
  assert.equal(SOURCE_REGLAGES.split('// --- DEBUT_TACHES ---').length, 2);
  assert.equal(SOURCE_REGLAGES.split('// --- FIN_TACHES ---').length, 2);
  const bloc = SOURCE_REGLAGES.slice(debut, fin);
  assert.match(bloc, /monterTaches\(/);
  assert.match(bloc, /\[data-zone-local\]/);
  for (const interdit of [/fetch/i, /localStorage/i, /indexedDB/i, /sessionStorage/i, /surChangement/, /modifierFournisseur/]) {
    assert.equal(interdit.test(bloc), false, `mention interdite dans le bloc des tâches : ${interdit}`);
  }
  const hors = SOURCE_REGLAGES.slice(0, debut) + SOURCE_REGLAGES.slice(fin);
  assert.equal((hors.match(/monterTaches/g) || []).length, 1, 'monterTaches n\'apparaît hors du bloc que dans son import');
});
