// ticket-39 — Choix « Utiliser Naissance sans moteur externe » dans les Réglages : préférence persistée sous une clé
// propre, désactivée par défaut, écrite seulement au geste. Ce fichier couvre le choix lui-même (persistance, retour
// au mode normal, montage dans les Réglages) ; ses effets sur la conversation (etat() → 'pret', repli fixe dans
// traiterTour, peutDemanderPlusFort, lancerRangement) sont testés dans tests/sans-moteur-conversation.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLE_SANS_MOTEUR, lireSansMoteur, ecrireSansMoteur, monterChoixSansMoteur } from '../app/reglages/sans-moteur.js';

const lu = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const MODULE = lu('app/reglages/sans-moteur.js');
const MAIN = lu('app/main.js');
const INDEX = lu('app/index.html');
const ECRAN_REGLAGES = lu('app/reglages/ecran.js');

// MISE À JOUR DÉLIBÉRÉE v0.66.18 : texte d'état rendu exact, le mode ne coupe que l'appel externe de la conversation.
const TEXTE_ACTIF = 'Mode local actif : la conversation ne demande rien à un moteur externe quand aucune voie locale ne répond.';
const TEXTE_INACTIF = 'Mode local inactif : fonctionnement normal.';
const LIBELLE = 'Utiliser Naissance sans moteur externe';

// --- stockage en mémoire, qui compte les écritures ---
function stockageMemoire(initial = {}) {
  const m = new Map(Object.entries(initial));
  const s = {
    ecritures: 0,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { s.ecritures += 1; m.set(k, String(v)); },
    removeItem: (k) => { s.ecritures += 1; m.delete(k); },
    clear: () => { s.ecritures += 1; m.clear(); },
    get length() { return m.size; },
    instantane: () => JSON.stringify([...m.entries()].sort()),
  };
  return s;
}

// --- faux DOM minimal : une zone, une case à cocher, un paragraphe d'état ---
class FauxElement {
  constructor(tag, attributs = {}) {
    this.tagName = String(tag).toUpperCase();
    this.attributs = { ...attributs };
    this.children = [];
    this.ecouteurs = {};
    this.textContent = '';
    this.checked = false;
  }
  hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attributs, n); }
  append(...es) { this.children.push(...es); }
  addEventListener(t, f) { (this.ecouteurs[t] ||= []).push(f); }
  querySelector(sel) {
    const m = /^\[([a-z-]+)\]$/.exec(sel);
    if (!m) throw new Error(`sélecteur non pris en charge : ${sel}`);
    for (const c of this.children) {
      if (c.hasAttribute(m[1])) return c;
      const t = c.querySelector(sel);
      if (t) return t;
    }
    return null;
  }
  // Geste : la personne touche la case (le navigateur inverse checked puis émet change).
  toucher() {
    this.checked = !this.checked;
    for (const f of this.ecouteurs.change || []) f({ type: 'change', target: this });
  }
}

function zoneNeuve() {
  const zone = new FauxElement('div', { 'data-zone-sans-moteur': '' });
  const label = new FauxElement('label');
  const caseChoix = new FauxElement('input', { type: 'checkbox', 'data-sans-moteur': '' });
  label.append(caseChoix);
  const etat = new FauxElement('p', { 'data-sans-moteur-etat': '' });
  zone.append(label, etat);
  return { zone, caseChoix, etat };
}

function monter(stockage) {
  const z = zoneNeuve();
  const changements = [];
  const m = monterChoixSansMoteur({ zone: z.zone, stockage, surChangement: (actif) => changements.push(actif) });
  return { ...z, ...m, changements };
}

test('clé propre, distincte des réglages du fournisseur', () => {
  assert.equal(CLE_SANS_MOTEUR, 'naissance-ia.sans-moteur.v1');
  assert.notEqual(CLE_SANS_MOTEUR, 'naissance-ia.reglages.v1');
});

test('stockage vide : inactif par défaut, case décochée, texte inactif, aucune écriture', () => {
  const s = stockageMemoire();
  assert.equal(lireSansMoteur(s), false);
  const m = monter(s);
  assert.equal(m.caseChoix.checked, false);
  assert.equal(m.etat.textContent, TEXTE_INACTIF);
  m.rafraichir();
  assert.equal(m.caseChoix.checked, false);
  assert.equal(m.etat.textContent, TEXTE_INACTIF);
  assert.equal(s.ecritures, 0);
  assert.equal(s.instantane(), '[]');
  assert.deepEqual(m.changements, []);
});

test('cocher écrit {"actif":true} ; un nouveau montage (rechargement) montre la case cochée et le texte actif', () => {
  const s = stockageMemoire();
  const m = monter(s);
  m.caseChoix.toucher();
  assert.equal(s.getItem(CLE_SANS_MOTEUR), '{"actif":true}');
  assert.equal(s.ecritures, 1);
  assert.equal(m.caseChoix.checked, true);
  assert.equal(m.etat.textContent, TEXTE_ACTIF);
  assert.deepEqual(m.changements, [true]);
  assert.equal(lireSansMoteur(s), true);

  const ecrituresAvant = s.ecritures;
  const recharge = monter(s);
  assert.equal(recharge.caseChoix.checked, true);
  assert.equal(recharge.etat.textContent, TEXTE_ACTIF);
  recharge.rafraichir();
  assert.equal(s.ecritures, ecrituresAvant);
  assert.deepEqual(recharge.changements, []);
});

test('décocher écrit {"actif":false} : retour au mode normal, y compris après remontage', () => {
  const s = stockageMemoire({ [CLE_SANS_MOTEUR]: '{"actif":true}' });
  const m = monter(s);
  assert.equal(m.caseChoix.checked, true);
  m.caseChoix.toucher();
  assert.equal(s.getItem(CLE_SANS_MOTEUR), '{"actif":false}');
  assert.equal(lireSansMoteur(s), false);
  assert.equal(m.caseChoix.checked, false);
  assert.equal(m.etat.textContent, TEXTE_INACTIF);
  assert.deepEqual(m.changements, [false]);
  const recharge = monter(s);
  assert.equal(recharge.caseChoix.checked, false);
  assert.equal(recharge.etat.textContent, TEXTE_INACTIF);
});

test('valeurs invalides : lireSansMoteur rend false et n\'écrit rien', () => {
  for (const brut of ['{actif:true', '"actif"', '{"actif":"true"}', '{"actif":1}', 'true', 'null', '[]', '[true]', '{"actif":true,"autre":1}', '{}', '']) {
    const s = stockageMemoire({ [CLE_SANS_MOTEUR]: brut });
    assert.equal(lireSansMoteur(s), false, brut);
    const m = monter(s);
    assert.equal(m.caseChoix.checked, false, brut);
    assert.equal(m.etat.textContent, TEXTE_INACTIF, brut);
    assert.equal(s.ecritures, 0, brut);
    assert.equal(s.getItem(CLE_SANS_MOTEUR), brut);
  }
  // Valeur sous une autre clé (réglages du fournisseur) : sans effet.
  assert.equal(lireSansMoteur(stockageMemoire({ 'naissance-ia.reglages.v1': '{"actif":true}' })), false);
});

test('panne ou absence du stockage : false, sans exception', () => {
  const enPanne = { getItem: () => { throw new Error('panne'); }, setItem: () => { throw new Error('panne'); } };
  assert.equal(lireSansMoteur(enPanne), false);
  assert.equal(lireSansMoteur(null), false);
  assert.equal(ecrireSansMoteur(true, enPanne), false);
  assert.equal(ecrireSansMoteur(true, null), false);
  // Une écriture refusée ne laisse pas croire au changement.
  const m = monter(enPanne);
  m.caseChoix.toucher();
  assert.equal(m.caseChoix.checked, false);
  assert.equal(m.etat.textContent, TEXTE_INACTIF);
  assert.deepEqual(m.changements, [false]);
});

test('ecrireSansMoteur : seule la valeur true stricte active', () => {
  const s = stockageMemoire();
  assert.equal(ecrireSansMoteur(true, s), true);
  assert.equal(s.getItem(CLE_SANS_MOTEUR), '{"actif":true}');
  for (const v of ['true', 1, {}, undefined, false]) {
    assert.equal(ecrireSansMoteur(v, s), true);
    assert.equal(s.getItem(CLE_SANS_MOTEUR), '{"actif":false}');
  }
});

test('zone absente : rafraichir sans effet, aucune écriture', () => {
  const s = stockageMemoire();
  for (const zone of [null, undefined, new FauxElement('div')]) {
    const m = monterChoixSansMoteur({ zone, stockage: s, surChangement: () => { throw new Error('jamais'); } });
    assert.equal(typeof m.rafraichir, 'function');
    m.rafraichir();
  }
  assert.equal(s.ecritures, 0);
});

// --- gardes statiques ---
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('[statique] app/reglages/sans-moteur.js : aucun import, ni fetch, ni indexedDB, ni sessionStorage', () => {
  assert.doesNotMatch(MODULE, /^\s*import\b/m);
  assert.doesNotMatch(MODULE, /\bimport\s*\(/);
  assert.doesNotMatch(MODULE, /\brequire\s*\(/);
  for (const interdit of ['fetch', 'indexedDB', 'sessionStorage', 'XMLHttpRequest', 'WebSocket', 'Math.random']) {
    assert.equal(MODULE.includes(interdit), false, interdit);
  }
});

test('[statique] main.js importe un sous-ensemble de { lireSansMoteur, reponseSansMoteur, monterChoixSansMoteur } et ne nomme jamais ecrireSansMoteur', () => {
  const imports = [...MAIN.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'\.\/reglages\/sans-moteur\.js';/gm)];
  assert.equal(imports.length, 1);
  const noms = imports[0][1].split(',').map((n) => n.trim()).filter(Boolean);
  assert.ok(noms.length >= 1);
  for (const n of noms) assert.ok(['lireSansMoteur', 'reponseSansMoteur', 'monterChoixSansMoteur'].includes(n), n);
  assert.ok(noms.includes('monterChoixSansMoteur'));
  assert.equal(MAIN.includes('ecrireSansMoteur'), false);
  assert.equal((MAIN.match(/sans-moteur\.js/g) || []).length, 1);
  // Montage sur la zone des Réglages, juste après monterReglages ; rafraîchi à l'ouverture des Réglages.
  const code = sansCommentaires(MAIN);
  assert.match(code, /const reglages = monterReglages\([^\n]*\);\nconst (\w+) = monterChoixSansMoteur\(\{ zone: panneaux\.reglages\.querySelector\('\[data-zone-sans-moteur\]'\)/);
  const nom = /const (\w+) = monterChoixSansMoteur\(/.exec(code)[1];
  assert.match(code, new RegExp(`if \\(nom === 'reglages'\\) \\{[^\\n]*\\b${nom}\\.rafraichir\\(\\)`));
});

test('[statique] index.html : zone, case, paragraphe d\'état et libellé exact, après le bouton des essais et avant le Fournisseur, hors des blocs BRANCHEMENT_ESSAIS', () => {
  const section = /<section id="reglages"[\s\S]*?<\/section>/.exec(INDEX)[0];
  const bloc = /<div class="bloc" data-zone-sans-moteur>([\s\S]*?)<\/div>/.exec(section);
  assert.ok(bloc, 'bloc data-zone-sans-moteur absent');
  assert.match(bloc[1], /<label[^>]*>\s*<input type="checkbox" data-sans-moteur>\s*<span>Utiliser Naissance sans moteur externe<\/span>\s*<\/label>/);
  assert.match(bloc[1], /<p class="aide" data-sans-moteur-etat aria-live="polite"><\/p>/);
  assert.equal((INDEX.match(/data-zone-sans-moteur/g) || []).length, 1);
  assert.equal((INDEX.match(/data-sans-moteur(?![-\w])/g) || []).length, 1);
  assert.equal((INDEX.match(/data-sans-moteur-etat/g) || []).length, 1);
  assert.equal(INDEX.split(LIBELLE).length - 1, 1);
  const finBouton = section.indexOf('<!-- === FIN_BRANCHEMENT_ESSAIS_BOUTON === -->');
  const iBloc = section.indexOf('data-zone-sans-moteur');
  const iFournisseur = section.indexOf('<span>Fournisseur</span>');
  assert.ok(finBouton > 0 && finBouton < iBloc && iBloc < iFournisseur);
  for (const [debut, fin] of [['DEBUT_BRANCHEMENT_ESSAIS_BOUTON', 'FIN_BRANCHEMENT_ESSAIS_BOUTON'], ['DEBUT_BRANCHEMENT_ESSAIS_ECRAN', 'FIN_BRANCHEMENT_ESSAIS_ECRAN']]) {
    const contenu = INDEX.slice(INDEX.indexOf(debut), INDEX.indexOf(fin));
    assert.equal(/sans-moteur|sans moteur/.test(contenu), false, debut);
  }
});

test('[statique] app/reglages/ecran.js ne connaît pas le choix sans moteur', () => {
  assert.equal(/sans-moteur|SansMoteur/.test(ECRAN_REGLAGES), false);
});
