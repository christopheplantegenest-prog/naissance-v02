// v0.66.8 — ATELIER 2, L3 : écran « Capacités en essai » : consultation, activation armée avec rappel de sauvegarde, coupure en un
// toucher, exécution manuelle, épreuve de panne (coupure automatique affichée), relecture des invariants, journal, export de la zone.
// DOM simulé ; bac simulé en mémoire (le témoin est un module pur) ; aucun réseau. Mécanisme technique, non cognitif.
import test from 'node:test';
import assert from 'node:assert/strict';
import { monterEssais } from '../app/essais/ecran.js';
import { creerPorte } from '../app/essais/porte.js';
import { zoneMemoireVive } from '../app/essais/zone.js';
import { executer as temoin } from '../app/essais/temoin-porte.js';
import * as R from '../app/essais/registre-essais.js';

class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.className = ''; this._texte = ''; this.disabled = false; this.attrs = {}; }
  get textContent() { return this._texte; }
  set textContent(v) { this._texte = String(v); this.children = []; }
  append(...cs) { for (const c of cs) assert.ok(c instanceof Faux, 'append : nœud attendu'); this.children.push(...cs); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
}
const tous = (e, f) => [...(f(e) ? [e] : []), ...e.children.flatMap((c) => tous(c, f))];
const textes = (e) => [e._texte, ...e.children.flatMap(textes)].filter(Boolean);
const attendre = async (n = 8) => { for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 0)); };
function stockageMemoire() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const bacPur = {
  disponible: true,
  executer({ entree }) {
    let r;
    try { const s = temoin(entree); r = s && typeof s.then === 'function' ? { type: 'asynchrone' } : { type: 'resultat', sortie: JSON.parse(JSON.stringify(s)) }; } catch (e) { r = { type: 'exception', message: e.message }; }
    return { promesse: Promise.resolve(r), annuler() {} };
  },
};
async function monter() {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  const zone = new Faux('div');
  const stockage = stockageMemoire();
  let t = Date.parse('2026-10-25T16:00:00Z');
  const porte = creerPorte({ stockage, obtenirZone: async () => zoneMemoireVive({ persistante: true }), lireTable: async () => [{ id: 'r1' }], version: '0.66.8', bac: bacPur, analyser: async () => ({ refus: [] }), maintenant: () => new Date(t += 1000).toISOString(), planifier: (f) => f() });
  const partages = [];
  const ecran = monterEssais({ zone, porte, partager: async (f) => { partages.push(f); } });
  await attendre();
  const trouver = (nom) => tous(zone, (e) => e.attrs['data-essais'] === nom);
  const un = (nom) => { const l = trouver(nom); assert.equal(l.length, 1, `« ${nom} » attendu une fois (${l.length})`); return l[0]; };
  const cliquer = async (nom) => { for (const g of un(nom).listeners.click) await g(); await attendre(); };
  return { zone, porte, stockage, ecran, trouver, un, cliquer, partages, texte: () => textes(zone).join('\n') };
}

test('écran : capacité inactive par défaut ; « Activer » s\'arme avec le rappel de sauvegarde puis active ; aucune exécution sans tour ni geste', async () => {
  const m = await monter();
  assert.match(m.un('temoin-porte-etat')._texte, /^État : Inactive$/);
  assert.match(m.texte(), /n'est pas un acquis de Naissance/);
  assert.match(m.un('temoin-porte-zone')._texte, /0 ligne/);
  await m.cliquer('temoin-porte-activer');
  assert.equal(m.un('temoin-porte-activer')._texte, 'Confirmer : Activer');
  assert.match(m.un('temoin-porte-activer-rappel')._texte, /sauvegarder la mémoire avant/);
  assert.equal(R.etatDe(R.lireRegistre(m.stockage), 'temoin-porte'), 'inactif', 'le premier toucher n\'active rien');
  await m.cliquer('temoin-porte-activer');
  assert.match(m.un('temoin-porte-etat')._texte, /^État : Active depuis 2026-10-25 16:00:0\d$/);
  assert.match(m.un('message')._texte, /s'exécutera après chaque tour/);
  assert.equal(m.trouver('temoin-porte-ligne').length, 0);
});
test('écran : exécution manuelle (ligne et provenance affichées), épreuve de panne armée = coupure automatique affichée, réactivation, coupure en un toucher, journal', async () => {
  const m = await monter();
  await m.cliquer('temoin-porte-activer');
  await m.cliquer('temoin-porte-activer');
  await m.cliquer('temoin-porte-executer');
  assert.match(m.un('message')._texte, /1 ligne\(s\) ajoutée\(s\)/);
  assert.match(m.un('temoin-porte-ligne')._texte, /n-1 — temoin-porte@0\.66\.8 — \{"numero":1,"receptions":1\}/);
  assert.match(m.un('temoin-porte-compteurs')._texte, /Exécutions : 1 — lignes écrites : 1 — anomalies : 0/);
  await m.cliquer('temoin-porte-relire');
  assert.match(m.un('message')._texte, /Invariants respectés \(1 ligne/);
  await m.cliquer('temoin-porte-epreuve-panne');
  assert.equal(m.un('temoin-porte-epreuve-panne')._texte, 'Confirmer : Provoquer : panne (exception)');
  await m.cliquer('temoin-porte-epreuve-panne');
  assert.match(m.un('temoin-porte-etat')._texte, /^État : Coupée/);
  assert.equal(m.un('temoin-porte-motif')._texte, 'Coupure automatique : exception : panne volontaire du témoin');
  assert.match(m.un('temoin-porte-compteurs')._texte, /anomalies : 1/);
  assert.equal(m.trouver('temoin-porte-couper').length, 0);
  assert.equal(m.trouver('temoin-porte-ligne').length, 1, 'la ligne écrite reste, marquée');
  await m.cliquer('temoin-porte-activer');
  assert.equal(m.un('temoin-porte-activer')._texte, 'Confirmer : Réactiver');
  await m.cliquer('temoin-porte-activer');
  await m.cliquer('temoin-porte-couper');
  assert.match(m.un('temoin-porte-etat')._texte, /^État : Coupée/);
  assert.equal(m.un('temoin-porte-motif')._texte, 'Coupée à la main : coupée à la main');
  const journal = m.trouver('journal-ligne').map((e) => e._texte);
  assert.match(journal[0], /coupure : coupée à la main$/);
  assert.ok(journal.some((l) => /coupure-automatique : exception : panne volontaire du témoin$/.test(l)));
  assert.ok(journal.some((l) => /activation : réactivée \(v0\.66\.8\)$/.test(l)));
});
test('écran : export de la zone d\'essai (fichier propre, la sauvegarde de Naissance n\'est pas concernée)', async () => {
  const m = await monter();
  await m.cliquer('temoin-porte-activer');
  await m.cliquer('temoin-porte-activer');
  await m.cliquer('temoin-porte-executer');
  await m.cliquer('exporter');
  assert.equal(m.partages.length, 1);
  assert.equal(m.partages[0].nom, 'naissance-zone-essais-0.66.8.json');
  const objet = JSON.parse(m.partages[0].contenu);
  assert.equal(objet.format, 'naissance-zone-essais');
  assert.deepEqual(objet.lignes.map((l) => l.provenance), ['temoin-porte@0.66.8']);
  assert.match(m.un('message')._texte, /Zone exportée : 1 ligne/);
});
