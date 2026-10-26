// v0.66.9 — ATELIER 2, L4 : CATALOGUE LIVRÉ des capacités en essai (app/capacites-essai/catalogue.json + un module <id>.js par capacité),
// forme que le robot reconnaît comme classe E. Contrôlé ici : lecture du catalogue (absent, illisible, refusé), chemin du module DÉRIVÉ de
// l'identifiant (jamais lu dans le fichier), priorité du catalogue figé, capacité retirée = coupée, sentinelles et mode sûr sur une capacité
// livrée. Mécanisme technique, non cognitif ; aucun réseau (fetch simulé).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../app/essais/registre-essais.js';
import { creerPorte, lireCatalogueLivre } from '../app/essais/porte.js';
import { ouvrirDemarrage } from '../app/essais/sentinelle.js';
import { zoneMemoireVive } from '../app/essais/zone.js';
import { TABLES } from '../app/langage/connaissances.js';

function stockageMemoire(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const capacite = (x = {}) => ({
  id: 'compte-receptions', titre: 'Compte des réceptions', description: 'essai', lit: ['receptions'], effet: 'zone-essai', declencheurs: ['apres-tour', 'manuel'],
  delaiMs: 2000, maxLignes: 1, invariants: [{ type: 'champs', champs: ['n'] }], ...x,
});
const catalogue = (capacites) => ({ format: R.FORMAT_CATALOGUE, v: 1, capacites });
const reponse = (status, texte) => ({ status, ok: status >= 200 && status < 300, text: async () => texte });

test('catalogue livré : déclaration recevable, module DÉRIVÉ de l\'identifiant, figée et marquée livrée', () => {
  const { declarations, refus } = R.declarationsLivrees(catalogue([capacite()]), { tables: TABLES });
  assert.deepEqual(refus, []);
  assert.equal(declarations.length, 1);
  const d = declarations[0];
  assert.equal(d.module, '../capacites-essai/compte-receptions.js');
  assert.equal(d.livree, true);
  assert.ok(Object.isFrozen(d) && Object.isFrozen(d.lit) && Object.isFrozen(d.invariants[0]));
  assert.equal(R.validerDeclaration(d, TABLES), null);
});
test('catalogue livré : refus (champ module, identifiant du catalogue figé, doublon, champ inconnu, effet, table inconnue, trop de capacités, format)', () => {
  const cas = [
    [catalogue([capacite({ module: '../essais/porte.js' })]), /champ refusé \(module\)/],
    [catalogue([capacite({ id: 'temoin-porte' })]), /identifiant déjà pris/],
    [catalogue([capacite(), capacite()]), /identifiant déjà pris/],
    [catalogue([capacite({ cible: 'x' })]), /champ refusé/],
    [catalogue([capacite({ effet: 'reponse' })]), /effet refusé/],
    [catalogue([capacite({ lit: ['receptions', 'inconnue'] })]), /lecture refusée/],
    [catalogue([capacite({ id: 'X' })]), /identifiant invalide/],
    [catalogue(Array.from({ length: R.CAPACITES_LIVREES_MAX + 1 }, (_, i) => capacite({ id: `cap-${i}` }))), /au plus/],
    [{ format: 'autre', v: 1, capacites: [] }, /illisible/],
    [{ format: R.FORMAT_CATALOGUE, v: 2, capacites: [] }, /illisible/],
    [[], /illisible/],
  ];
  for (const [objet, re] of cas) {
    const { declarations, refus } = R.declarationsLivrees(objet, { tables: TABLES });
    assert.ok(refus.some((m) => re.test(m)), `${JSON.stringify(objet).slice(0, 80)} -> ${refus.join(' | ')}`);
    assert.ok(!declarations.some((d) => d.id === 'temoin-porte'));
  }
  // une capacité refusée n'empêche pas les autres
  const r = R.declarationsLivrees(catalogue([capacite({ effet: 'reponse' }), capacite({ id: 'autre-capacite' })]), { tables: TABLES });
  assert.deepEqual(r.declarations.map((d) => d.id), ['autre-capacite']);
  assert.equal(r.refus.length, 1);
});
test('catalogue livré : lecture (absent = rien, illisible = refus journalisable, valide = déclarations)', async () => {
  assert.deepEqual(await lireCatalogueLivre({ fetchFn: async () => reponse(404, '') }), { declarations: [], refus: [] });
  assert.deepEqual(await lireCatalogueLivre({ fetchFn: async () => { throw new Error('hors ligne'); } }), { declarations: [], refus: [] });
  assert.match((await lireCatalogueLivre({ fetchFn: async () => reponse(200, '{') })).refus[0], /JSON/);
  assert.match((await lireCatalogueLivre({ fetchFn: async () => reponse(500, '') })).refus[0], /HTTP 500/);
  const urls = [];
  const ok = await lireCatalogueLivre({ fetchFn: async (u, o) => { urls.push([String(u), o]); return reponse(200, JSON.stringify(catalogue([capacite()]))); }, tables: TABLES });
  assert.deepEqual(ok.declarations.map((d) => d.id), ['compte-receptions']);
  assert.match(urls[0][0], /\/app\/capacites-essai\/catalogue\.json$/);
  assert.deepEqual(urls[0][1], { cache: 'no-store' });
});

function porteAvec(stockage, decls, { lignes = [{ id: 'r1' }] } = {}) {
  let t = Date.parse('2026-10-25T20:00:00Z');
  const modules = [];
  const bac = { disponible: true, executer({ module, entree }) { modules.push(module); return { promesse: Promise.resolve({ type: 'resultat', sortie: { lignes: [{ cle: `n-${entree.miennes.length + 1}`, donnees: { n: entree.lues.receptions.length } }] } }), annuler() {} }; } };
  const porte = creerPorte({ stockage, obtenirZone: async () => zoneMemoireVive({ persistante: true }), lireTable: async () => lignes, version: '0.66.9', bac, analyser: async () => ({ refus: [] }),
    maintenant: () => new Date(t += 1000).toISOString(), planifier: (f) => f(), catalogue: [...R.CATALOGUE, ...decls], tables: TABLES });
  return { porte, modules };
}
test('porte : une capacité livrée s\'active, s\'exécute par SON module dérivé et écrit dans la zone avec sa provenance', async () => {
  const { declarations } = R.declarationsLivrees(catalogue([capacite()]), { tables: TABLES });
  const s = stockageMemoire();
  const { porte, modules } = porteAvec(s, declarations);
  assert.deepEqual(porte.liste().map((x) => [x.declaration.id, x.etat]), [['temoin-porte', 'inactif'], ['compte-receptions', 'inactif']]);
  assert.deepEqual(await porte.activer('compte-receptions'), { ok: true, motif: null });
  assert.equal(R.aucunEssaiActif(s), false);
  assert.ok(porte.apresTour());
  await porte.attendre();
  assert.deepEqual(modules, ['../capacites-essai/compte-receptions.js']);
  const l = await porte.lignes('compte-receptions');
  assert.deepEqual(l.map((x) => [x.cle, x.provenance, x.donnees]), [['n-1', 'compte-receptions@0.66.9', { n: 1 }]]);
});
test('porte : capacité active RETIRÉE du catalogue (classe R) = coupée à la création de la porte, rien ne s\'exécute', async () => {
  const { declarations } = R.declarationsLivrees(catalogue([capacite()]), { tables: TABLES });
  const s = stockageMemoire();
  await porteAvec(s, declarations).porte.activer('compte-receptions');
  const { porte, modules } = porteAvec(s, []);
  const r = R.lireRegistre(s);
  assert.equal(R.etatDe(r, 'compte-receptions'), 'coupe');
  assert.match(r.essais['compte-receptions'].motif, /absente du catalogue/);
  assert.equal(r.essais['compte-receptions'].auto, true);
  assert.equal(porte.apresTour(), false);
  assert.deepEqual(modules, []);
  assert.ok(R.aucunEssaiActif(s));
});
test('porte : table déclarée inconnue de l\'application = activation refusée (tables fournies par main.js)', async () => {
  const d = R.declarationsLivrees(catalogue([capacite({ lit: ['inconnue'] })])).declarations;
  assert.equal(d.length, 1, 'sans liste de tables, la forme seule est contrôlée');
  const { porte } = porteAvec(stockageMemoire(), d);
  const v = await porte.activer('compte-receptions');
  assert.equal(v.ok, false);
  assert.match(v.motif, /lecture refusée/);
});
test('sentinelles : une capacité LIVRÉE active est coupée par le mode sûr (démarrage interrompu), comme le témoin', () => {
  const r0 = R.activer(R.activer(R.lireRegistre(stockageMemoire()), 'compte-receptions', 't0', '0.66.9'), 'temoin-porte', 't0', '0.66.9');
  const s = stockageMemoire({ [R.CLE_REGISTRE]: JSON.stringify(r0), [R.CLE_DEMARRAGE]: 't0' });
  const { coupes } = ouvrirDemarrage(s, 't1');
  assert.deepEqual(coupes.map((c) => c.id).sort(), ['compte-receptions', 'temoin-porte']);
  assert.ok(R.aucunEssaiActif(s));
  assert.deepEqual(R.essaisActifs(r0), ['compte-receptions', 'temoin-porte']);
  assert.deepEqual(R.essaisActifs(r0, R.CATALOGUE), ['temoin-porte']);
});
