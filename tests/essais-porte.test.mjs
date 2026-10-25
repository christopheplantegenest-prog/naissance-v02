// v0.66.8 — ATELIER 2, L3 (GO « ATELIER 2 — GO CONSTRUCTION L3 », 25/10/2026) : porte d'essai des capacités expérimentales.
// Registre (état local, transitions, journal borné), sentinelles (démarrage, exécution), porte (activation, exécution après un tour,
// coupure manuelle et automatique, résultat écarté après coupure, écriture déjà engagée, invariants, relecture, nouvelle version),
// zone d'essai (ajout seul, tout ou rien, export/import sans écrasement), neutralité vis-à-vis de la base de Naissance et de sa sauvegarde,
// persistance et redémarrage. Bac simulé ici par un realm node:vm VERROUILLÉ (même verrou que le Worker) ; le Worker réel est essayé dans
// Chromium (rapport L3). Mécanisme technique, non cognitif ; aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../app/essais/registre-essais.js';
import { ouvrirDemarrage, fermerDemarrage, marquerExecution } from '../app/essais/sentinelle.js';
import { creerPorte, validerSortie, motifReponse, bacWorker } from '../app/essais/porte.js';
import { zoneMemoireVive, exporterZone, importerZone, ligneValide, FORMAT_ZONE } from '../app/essais/zone.js';
import { verrouiller } from '../app/essais/verrou.js';
import { magasinMemoireVive, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { construireSauvegardeComplete, SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_TEMOIN = readFileSync(join(RACINE, 'app', 'essais', 'temoin-porte.js'), 'utf8');
const ID = 'temoin-porte';
const attendre = () => new Promise((r) => setTimeout(r, 0));

function stockageMemoire(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
function horloge(depart = Date.parse('2026-10-25T16:00:00Z')) {
  let t = depart;
  return () => { t += 1000; return new Date(t).toISOString(); };
}
// Bac simulé : un realm node:vm neuf par exécution, verrouillé par verrouiller() AVANT le code de la capacité (comme bac.js), entrée passée
// en JSON (copie, comme postMessage), délai par l'option timeout de vm (comme la terminaison du Worker).
function bacVm({ source = SOURCE_TEMOIN, delaiForce = null, retenir = false } = {}) {
  const appels = [];
  const enAttente = [];
  return {
    disponible: true,
    appels,
    enAttente,
    executer({ module, entree, delaiMs }) {
      appels.push({ module, entree, delaiMs });
      let ok;
      const promesse = new Promise((r) => { ok = r; });
      const calculer = () => {
        const ctx = vm.createContext({ __entree: JSON.stringify(entree) });
        // Un seul script, sous le délai : lecture de l'entrée (copie), VERROU, puis code de la capacité et appel synchrone (comme bac.js).
        const code = `(function () {
  'use strict';
  const texte = globalThis.__entree;
  const v = (${verrouiller.toString()})(globalThis);
  if (v.restants.length) return { type: 'verrou', restants: v.restants.join() };
  ${source.replace(/export function executer/, 'function executer')}
  let s;
  try { s = executer(JSON.parse(texte)); } catch (e) { return { type: 'exception', message: String(e && e.message) }; }
  let p = false;
  try { p = s !== null && (typeof s === 'object' || typeof s === 'function') && typeof s.then === 'function'; } catch { p = true; }
  return p ? { type: 'asynchrone' } : { type: 'resultat', sortie: JSON.stringify(s) };
})()`;
        try {
          const r = vm.runInContext(code, ctx, { timeout: delaiForce ?? delaiMs });
          if (r.type === 'resultat') return { type: 'resultat', sortie: r.sortie === undefined ? undefined : JSON.parse(r.sortie) };
          return r.type === 'verrou' ? { type: 'verrou', restants: r.restants.split(',') } : { type: r.type, ...(r.message !== undefined ? { message: r.message } : {}) };
        } catch (e) {
          return /timed out/i.test(String(e && e.message)) ? { type: 'delai' } : { type: 'exception', message: String(e && e.message) };
        }
      };
      if (retenir) enAttente.push(() => ok(calculer())); else setTimeout(() => ok(calculer()), 0);
      return { promesse, annuler: () => ok({ type: 'annule' }) };
    },
  };
}
const analyseOk = async () => ({ refus: [] });
function monter({ stockage = stockageMemoire(), zone = zoneMemoireVive({ persistante: true }), lues = { receptions: [{ id: 'r1' }, { id: 'r2' }] }, bac = bacVm(), analyser = analyseOk, version = '0.66.8', maintenant = horloge(), magasin = null } = {}) {
  const lectures = [];
  const lireTable = async (t) => { lectures.push(t); return magasin ? magasin.lireTout(t) : (lues[t] || []); };
  const planifies = [];
  const porte = creerPorte({ stockage, obtenirZone: async () => zone, lireTable, version, bac, analyser, maintenant, planifier: (fn) => planifies.push(fn) });
  const tour = async () => { porte.apresTour(); while (planifies.length) planifies.shift()(); await porte.attendre(); };
  return { porte, stockage, zone, bac, lectures, planifies, tour };
}

// ------------------------------------------------------------------------------------------------ registre
test('registre : catalogue recevable ; état par défaut INACTIF ; état illisible = rien d\'actif ; journal borné', () => {
  assert.deepEqual(R.CATALOGUE.map(R.validerDeclaration), [null]);
  assert.ok(Object.isFrozen(R.CATALOGUE) && Object.isFrozen(R.CATALOGUE[0]) && Object.isFrozen(R.CATALOGUE[0].invariants));
  const s = stockageMemoire();
  assert.equal(R.etatDe(R.lireRegistre(s), ID), 'inactif');
  assert.ok(R.aucunEssaiActif(s));
  for (const brut of ['{', '[]', '{"v":2,"essais":{},"journal":[]}', '{"v":1,"essais":{"temoin-porte":{"etat":"autre"}},"journal":[]}']) {
    assert.ok(R.aucunEssaiActif(stockageMemoire({ [R.CLE_REGISTRE]: brut })), brut);
  }
  assert.ok(R.aucunEssaiActif({ getItem: () => { throw new Error('refus'); } }));
  let r = R.lireRegistre(s);
  for (let i = 0; i < 100; i += 1) r = R.journaliser(r, `t${i}`, ID, 'x', 'y'.repeat(400));
  assert.equal(r.journal.length, R.MAX_JOURNAL);
  assert.equal(r.journal.at(-1).quand, 't99');
  assert.equal(r.journal[0].texte.length, 300);
});
test('registre : déclarations refusées (effet autre que la zone d\'essai, table inconnue, module hors chemin, bornes, invariants)', () => {
  const d = R.CATALOGUE[0];
  const cas = [
    [{ ...d, effet: 'tables' }, /effet refusé/],
    [{ ...d, effet: 'reponse' }, /n'est pas isolable/],
    [{ ...d, lit: ['receptions', 'inconnue'] }, /lecture refusée/],
    [{ ...d, lit: ['receptions', 'receptions'] }, /lecture refusée/],
    [{ ...d, module: 'https://exemple.org/x.js' }, /module invalide/],
    [{ ...d, module: '/app/x.js' }, /module invalide/],
    [{ ...d, module: './a/../../x.js' }, /module invalide/],
    [{ ...d, declencheurs: ['demarrage'] }, /déclencheur/],
    [{ ...d, delaiMs: 60000 }, /délai/],
    [{ ...d, maxLignes: 500 }, /lignes/],
    [{ ...d, invariants: [{ type: 'apres-installation' }, { type: 'apres-installation' }, { type: 'apres-installation' }, { type: 'apres-installation' }] }, /3 au plus/],
    [{ ...d, invariants: [{ type: 'score' }] }, /inconnu/],
    [{ ...d, epreuves: ['autre'] }, /épreuve/],
    [{ ...d, id: 'X' }, /identifiant/],
  ];
  for (const [decl, re] of cas) assert.match(R.validerDeclaration(decl) || '', re, JSON.stringify(decl).slice(0, 80));
});
test('registre : invariants (champs, unique, après installation, max par exécution)', () => {
  const d = { invariants: [{ type: 'champs', champs: ['numero'] }, { type: 'unique', champ: 'numero' }, { type: 'apres-installation' }] };
  const e = { installe: '2026-10-25T10:00:00Z' };
  const l = (n, h = '2026-10-25T11:00:00Z', ex = `x${n}`) => ({ id: `t/${n}`, horodatage: h, execution: ex, donnees: { numero: n } });
  assert.equal(R.violationInvariants(d, e, [l(1)], [l(2)]), null);
  assert.match(R.violationInvariants(d, e, [l(1)], [l(1)]), /unique/);
  assert.match(R.violationInvariants(d, e, [], [{ ...l(1), donnees: {} }]), /champs/);
  assert.match(R.violationInvariants(d, e, [], [l(1, '2026-10-25T09:00:00Z')]), /après installation/);
  const m = { invariants: [{ type: 'max-par-execution', n: 1 }] };
  assert.equal(R.violationInvariants(m, e, [l(1, undefined, 'a')], [l(2, undefined, 'b')]), null);
  assert.match(R.violationInvariants(m, e, [l(1, undefined, 'a'), l(2, undefined, 'a')], []), /max-par-execution/);
});

// ------------------------------------------------------------------------------------------------ sentinelles
test('sentinelles : démarrage normal sans effet ; démarrage interrompu = mode sûr (toutes les capacités actives coupées) ; arrêt pendant une exécution = cette capacité coupée', () => {
  const s = stockageMemoire();
  assert.deepEqual(ouvrirDemarrage(s, '2026-10-25T16:00:00Z'), { coupes: [] });
  assert.ok(s.getItem(R.CLE_DEMARRAGE));
  fermerDemarrage(s);
  assert.equal(s.getItem(R.CLE_DEMARRAGE), null);
  // une capacité active, démarrage complet : rien n'est coupé
  R.ecrireRegistre(R.activer(R.lireRegistre(s), ID, '2026-10-25T16:01:00Z', '0.66.8'), s);
  assert.deepEqual(ouvrirDemarrage(s, '2026-10-25T16:02:00Z'), { coupes: [] });
  fermerDemarrage(s);
  assert.equal(R.etatDe(R.lireRegistre(s), ID), 'actif');
  // démarrage précédent jamais terminé
  ouvrirDemarrage(s, '2026-10-25T16:03:00Z');
  const r = ouvrirDemarrage(s, '2026-10-25T16:04:00Z');
  assert.deepEqual(r.coupes, [{ id: ID, motif: 'démarrage précédent interrompu (mode sûr)' }]);
  const e = R.lireRegistre(s).essais[ID];
  assert.equal(e.etat, 'coupe');
  assert.equal(e.auto, true);
  assert.equal(e.anomalies, 1);
  fermerDemarrage(s);
  // arrêt pendant une exécution
  R.ecrireRegistre(R.activer(R.lireRegistre(s), ID, '2026-10-25T16:05:00Z', '0.66.8'), s);
  marquerExecution(s, ID, '2026-10-25T16:06:00Z');
  const r2 = ouvrirDemarrage(s, '2026-10-25T16:07:00Z');
  assert.deepEqual(r2.coupes, [{ id: ID, motif: 'application arrêtée pendant une exécution de la capacité' }]);
  assert.equal(s.getItem(R.CLE_EXECUTION), null);
  // aucune capacité active : une marque restante ne coupe rien et ne produit aucun bandeau
  fermerDemarrage(s);
  ouvrirDemarrage(s, '2026-10-25T16:08:00Z');
  assert.deepEqual(ouvrirDemarrage(s, '2026-10-25T16:09:00Z'), { coupes: [] });
  // stockage indisponible : rien, sans exception
  assert.deepEqual(ouvrirDemarrage(null), { coupes: [] });
  assert.deepEqual(ouvrirDemarrage({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => {} }), { coupes: [] });
});

// ------------------------------------------------------------------------------------------------ porte : chemin normal
test('porte : inactive par défaut, un tour ne charge rien, ne lit rien, n\'exécute rien', async () => {
  const m = monter();
  assert.equal(m.porte.apresTour(), false);
  assert.equal(m.planifies.length, 0);
  await m.tour();
  assert.equal(m.bac.appels.length, 0);
  assert.deepEqual(m.lectures, []);
  assert.equal((await m.zone.lireTout()).length, 0);
});
test('porte : activation puis exécution APRÈS chaque tour ; lignes ajoutées avec leur provenance ; lecture par copie des seules tables déclarées', async () => {
  const lues = { receptions: [{ id: 'r1', donnees: { a: 1 } }] };
  const m = monter({ lues });
  assert.deepEqual(await m.porte.activer(ID), { ok: true, motif: null });
  assert.equal(m.porte.apresTour(), true);
  assert.equal(m.bac.appels.length, 0, 'rien ne s\'exécute pendant le tour : tout est différé');
  while (m.planifies.length) m.planifies.shift()();
  await m.porte.attendre();
  await m.tour();
  const lignes = (await m.zone.lire(ID)).sort((a, b) => a.donnees.numero - b.donnees.numero);
  assert.equal(lignes.length, 2);
  for (const l of lignes) assert.ok(ligneValide(l));
  assert.deepEqual(lignes.map((l) => [l.id, l.provenance, l.declencheur, l.donnees]), [[`${ID}/n-1`, `${ID}@0.66.8`, 'apres-tour', { numero: 1, receptions: 1 }], [`${ID}/n-2`, `${ID}@0.66.8`, 'apres-tour', { numero: 2, receptions: 1 }]]);
  assert.deepEqual(m.lectures, ['receptions', 'receptions']);
  assert.deepEqual(m.bac.appels[0].entree.lues, lues);
  assert.notEqual(m.bac.appels[0].entree.lues.receptions, lues.receptions, 'copie, jamais l\'objet de l\'application');
  const e = R.lireRegistre(m.stockage).essais[ID];
  assert.deepEqual([e.executions, e.lignes, e.anomalies], [2, 2, 0]);
  assert.equal(m.stockage.getItem(R.CLE_EXECUTION), null, 'marque d\'exécution retirée après chaque exécution');
});
test('porte : activation refusée (bac indisponible, zone non persistante, code refusé par l\'analyse, capacité inconnue) ; refus journalisé', async () => {
  assert.match((await monter({ bac: { disponible: false } }).porte.activer(ID)).motif, /isolation impossible/);
  assert.match((await monter({ zone: zoneMemoireVive({ persistante: false }) }).porte.activer(ID)).motif, /zone d'essai indisponible/);
  const m = monter({ analyser: async () => ({ refus: ['temoin-porte.js : mot interdit : fetch'] }) });
  assert.match((await m.porte.activer(ID)).motif, /code refusé : temoin-porte.js : mot interdit : fetch/);
  assert.equal(R.etatDe(R.lireRegistre(m.stockage), ID), 'inactif');
  assert.equal(R.lireRegistre(m.stockage).journal.at(-1).type, 'refus');
  assert.match((await monter({ analyser: async () => { throw new Error('réseau'); } }).porte.activer(ID)).motif, /analyse impossible/);
  assert.match((await monter().porte.activer('inconnue')).motif, /inconnue du registre/);
});

// ------------------------------------------------------------------------------------------------ porte : anomalies et coupure automatique
test('porte : chaque épreuve du témoin coupe la capacité automatiquement, sans rien écrire (exception, délai, asynchrone, évasion bloquée par le verrou, forme, doublon)', async () => {
  const attendus = {
    panne: /exception : panne volontaire du témoin/,
    boucle: /délai dépassé/,
    asynchrone: /asynchrone refusé/,
    evasion: /exception : .*not a function/,
    forme: /50 lignes \(au plus 1\)/,
    doublon: /écriture refusée : clé déjà écrite : temoin-porte\/n-1/,
  };
  for (const [ep, re] of Object.entries(attendus)) {
    const m = monter({ bac: bacVm({ delaiForce: ep === 'boucle' ? 50 : null }) });
    await m.porte.activer(ID);
    assert.equal((await m.porte.executerMaintenant(ID)).statut, 'ecrit');
    const r = await m.porte.executerMaintenant(ID, { epreuve: ep });
    assert.equal(r.statut, 'coupe', ep);
    assert.match(r.motif, re, ep);
    const e = R.lireRegistre(m.stockage).essais[ID];
    assert.deepEqual([e.etat, e.auto, e.anomalies], ['coupe', true, 1], ep);
    assert.equal((await m.zone.lire(ID)).length, 1, `${ep} : rien de plus n'est écrit`);
    // coupée : un tour ne l'exécute plus
    const avant = m.bac.appels.length;
    await m.tour();
    assert.equal(m.bac.appels.length, avant, ep);
  }
});
test('porte : sortie invalide refusée avant toute écriture (forme, clé, taille, valeurs) ; motifs du bac', () => {
  const d = { maxLignes: 2 };
  assert.match(validerSortie(null, d).motif, /lignes/);
  assert.match(validerSortie({ lignes: [{ cle: 'a b', donnees: {} }] }, d).motif, /clé/);
  assert.match(validerSortie({ lignes: [{ cle: 'a', donnees: {} }, { cle: 'a', donnees: {} }] }, d).motif, /double/);
  assert.match(validerSortie({ lignes: [{ cle: 'a', donnees: [] }] }, d).motif, /non objet/);
  assert.match(validerSortie({ lignes: [{ cle: 'a', donnees: { t: 'x'.repeat(3000) } }] }, d).motif, /trop longues/);
  assert.match(validerSortie({ lignes: [1, 2, 3] }, d).motif, /3 lignes/);
  assert.deepEqual(validerSortie({ lignes: [{ cle: 'a', donnees: { n: 1, d: new Date(0), u: undefined } }] }, d), { lignes: [{ cle: 'a', donnees: { n: 1, d: '1970-01-01T00:00:00.000Z' } }] });
  assert.match(motifReponse({ type: 'verrou', restants: ['indexedDB'] }), /isolation impossible/);
  assert.match(motifReponse({ type: 'erreur', message: 'module' }), /bac en erreur/);
  assert.match(motifReponse(null), /illisible/);
  assert.match(motifReponse({ type: 'autre' }), /inattendue/);
});
test('porte : invariant violé AVANT écriture = coupure, rien n\'est écrit (déclaration d\'essai exigeant un champ que la capacité ne produit pas)', async () => {
  const exigeante = Object.freeze({ ...R.CATALOGUE[0], invariants: [{ type: 'champs', champs: ['numero', 'absent'] }] });
  assert.equal(R.validerDeclaration(exigeante), null);
  const stockage = stockageMemoire();
  const zone = zoneMemoireVive({ persistante: true });
  const planifies = [];
  const porte = creerPorte({ stockage, obtenirZone: async () => zone, lireTable: async () => [], version: '0.66.8', bac: bacVm(), analyser: analyseOk, maintenant: horloge(), planifier: (f) => planifies.push(f), catalogue: [exigeante] });
  await porte.activer(ID);
  const r = await porte.executerMaintenant(ID);
  assert.equal(r.statut, 'coupe');
  assert.match(r.motif, /invariant « champs » violé \(ligne temoin-porte\/n-1\)/);
  assert.equal((await zone.lireTout()).length, 0);
});
test('porte : relecture d\'une zone altérée = coupure', async () => {
  const m = monter();
  await m.porte.activer(ID);
  await m.porte.executerMaintenant(ID);
  assert.deepEqual(await m.porte.relire(ID), { statut: 'conforme', lignes: 1 });
  // altération de la zone par un tiers : une ligne sans « receptions »
  await m.zone.ajouter([{ id: `${ID}/alteree`, essai: ID, cle: 'alteree', version: '0.66.8', provenance: `${ID}@0.66.8`, horodatage: '2026-10-25T17:00:00Z', declencheur: 'manuel', execution: 'x', donnees: { numero: 9 } }]);
  const r = await m.porte.relire(ID);
  assert.equal(r.statut, 'coupe');
  assert.match(r.motif, /champs/);
  assert.match(R.lireRegistre(m.stockage).essais[ID].motif, /^relecture : invariant « champs » violé/);
});

// ------------------------------------------------------------------------------------------------ porte : coupure et effets asynchrones
test('coupure PENDANT une exécution : le bac est terminé, le résultat est écarté, rien n\'est écrit ; le tour suivant n\'exécute rien', async () => {
  const bac = bacVm({ retenir: true });
  const m = monter({ bac });
  await m.porte.activer(ID);
  const p = m.porte.executerMaintenant(ID);
  for (let i = 0; i < 10 && !m.porte.enCours(ID); i += 1) await attendre();
  assert.ok(m.porte.enCours(ID));
  assert.equal(m.stockage.getItem(R.CLE_EXECUTION) !== null, true, 'marque d\'exécution posée pendant l\'exécution');
  assert.equal(m.porte.couper(ID), true);
  assert.deepEqual(await p, { statut: 'ecarte' });
  bac.enAttente.forEach((f) => f()); // le calcul « tardif » ne peut plus rien livrer
  await attendre();
  assert.equal((await m.zone.lireTout()).length, 0);
  assert.equal(m.stockage.getItem(R.CLE_EXECUTION), null);
  assert.match(R.lireRegistre(m.stockage).journal.at(-1).texte, /résultat écarté/);
  const n = bac.appels.length;
  await m.tour();
  assert.equal(bac.appels.length, n);
});
test('coupure pendant une écriture DÉJÀ ENGAGÉE : la transaction se termine (tout ou rien), ses lignes restent marquées, le journal le dit ; aucune écriture ne commence après', async () => {
  const base = zoneMemoireVive({ persistante: true });
  let liberer;
  const lente = { ...base, persistante: true, lire: (id) => base.lire(id), lireTout: () => base.lireTout(), ajouter: (l) => new Promise((ok) => { liberer = () => ok(base.ajouter(l)); }) };
  const m = monter({ zone: lente });
  await m.porte.activer(ID);
  const p = m.porte.executerMaintenant(ID);
  for (let i = 0; i < 20 && !m.porte.engagee(ID); i += 1) await attendre();
  assert.ok(m.porte.engagee(ID));
  m.porte.couper(ID);
  liberer();
  assert.deepEqual(await p, { statut: 'ecrit', lignes: 1 });
  const lignes = await base.lireTout();
  assert.deepEqual(lignes.map((l) => l.provenance), [`${ID}@0.66.8`]);
  const r = R.lireRegistre(m.stockage);
  assert.equal(r.essais[ID].etat, 'coupe');
  assert.equal(r.journal.at(-1).type, 'ecriture-engagee');
  await m.tour();
  assert.equal((await base.lireTout()).length, 1);
});
test('coupure manuelle, réactivation : compteurs conservés, date d\'installation conservée, état persistant', async () => {
  const m = monter();
  await m.porte.activer(ID);
  await m.porte.executerMaintenant(ID);
  const installe = R.lireRegistre(m.stockage).essais[ID].installe;
  assert.equal(m.porte.couper(ID), true);
  assert.equal(m.porte.couper(ID), false, 'déjà coupée');
  let e = R.lireRegistre(m.stockage).essais[ID];
  assert.deepEqual([e.etat, e.auto, e.motif, e.anomalies], ['coupe', false, 'coupée à la main', 0]);
  await m.porte.activer(ID);
  await m.porte.executerMaintenant(ID);
  e = R.lireRegistre(m.stockage).essais[ID];
  assert.deepEqual([e.etat, e.executions, e.lignes, e.installe], ['actif', 2, 2, installe]);
});

// ------------------------------------------------------------------------------------------------ persistance, redémarrage, nouvelle version
test('redémarrage : une porte neuve sur le même stockage et la même zone retrouve l\'état, les compteurs et les lignes, et reprend la numérotation', async () => {
  const stockage = stockageMemoire();
  const zone = zoneMemoireVive({ persistante: true });
  const a = monter({ stockage, zone });
  await a.porte.activer(ID);
  await a.tour();
  await a.tour();
  const b = monter({ stockage, zone, maintenant: horloge(Date.parse('2026-10-26T08:00:00Z')) });
  assert.equal(b.porte.liste()[0].etat, 'actif');
  assert.equal(b.porte.liste()[0].detail.executions, 2);
  await b.tour();
  assert.deepEqual((await zone.lire(ID)).map((l) => l.donnees.numero).sort(), [1, 2, 3]);
  // la même porte, coupée puis redémarrée : reste coupée
  b.porte.couper(ID);
  const c = monter({ stockage, zone });
  await c.tour();
  assert.equal(c.bac.appels.length, 0);
  assert.equal(c.porte.liste()[0].etat, 'coupe');
});
test('nouvelle version installée : le code est revérifié avant la première exécution ; refusé = coupure automatique', async () => {
  const stockage = stockageMemoire();
  const zone = zoneMemoireVive({ persistante: true });
  const a = monter({ stockage, zone, version: '0.66.8' });
  await a.porte.activer(ID);
  let analyses = 0;
  const b = monter({ stockage, zone, version: '0.66.9', analyser: async () => { analyses += 1; return { refus: [] }; } });
  await b.porte.executerMaintenant(ID);
  assert.equal(analyses, 1);
  assert.equal(R.lireRegistre(stockage).essais[ID].verifie, '0.66.9');
  await b.porte.executerMaintenant(ID);
  assert.equal(analyses, 1, 'une seule vérification par version');
  const c = monter({ stockage, zone, version: '0.67.0', analyser: async () => ({ refus: ['x : mot interdit : fetch'] }) });
  const r = await c.porte.executerMaintenant(ID);
  assert.equal(r.statut, 'coupe');
  assert.match(R.lireRegistre(stockage).essais[ID].motif, /version 0\.67\.0 refusée/);
  assert.deepEqual((await zone.lire(ID)).map((l) => l.provenance), [`${ID}@0.66.9`, `${ID}@0.66.9`], 'chaque ligne porte la version qui l\'a écrite');
});

// ------------------------------------------------------------------------------------------------ zone, provenance, sauvegarde
test('zone : ajout seul, tout ou rien ; aucune suppression ni remplacement possible ; export / import sans écrasement', async () => {
  const z = zoneMemoireVive({ persistante: true });
  const l = (cle, n) => ({ id: `${ID}/${cle}`, essai: ID, cle, version: '0.66.8', provenance: `${ID}@0.66.8`, horodatage: '2026-10-25T16:00:00Z', declencheur: 'manuel', execution: 'e', donnees: { numero: n } });
  await z.ajouter([l('a', 1)]);
  await assert.rejects(z.ajouter([l('b', 2), l('a', 9)]), /clé déjà écrite/);
  assert.deepEqual((await z.lireTout()).map((x) => x.cle), ['a'], 'le lot refusé n\'a rien écrit');
  await assert.rejects(z.ajouter([{ ...l('c', 3), provenance: 'autre@0.66.8' }]), /invalide/);
  assert.equal(typeof z.supprimer, 'undefined');
  assert.equal(typeof z.remplacer, 'undefined');
  const exporte = await exporterZone(z, { versionAppli: '0.66.8', maintenant: '2026-10-25T18:00:00Z' });
  assert.equal(exporte.format, FORMAT_ZONE);
  const z2 = zoneMemoireVive({ persistante: true });
  await z2.ajouter([l('b', 2)]);
  const imp = await importerZone(z2, JSON.parse(JSON.stringify({ ...exporte, lignes: [...exporte.lignes, { ...l('b', 2), donnees: { numero: 99 } }, { pas: 'une ligne' }] })));
  assert.deepEqual([imp.ajoutees, imp.deja], [1, 0]);
  assert.equal(imp.refusees.length, 2);
  assert.match(imp.refusees.join(), /contradiction avec la ligne présente temoin-porte\/b \(conservée\)/);
  assert.deepEqual((await z2.lireTout()).map((x) => [x.cle, x.donnees.numero]).sort(), [['a', 1], ['b', 2]]);
  assert.deepEqual((await importerZone(z2, exporte)), { ajoutees: 0, deja: 1, refusees: [] });
  assert.deepEqual((await importerZone(z2, { format: 'autre' })).refusees, ['fichier de zone illisible']);
});
test('neutralité : la porte ne fait que LIRE la base de Naissance (lireTout des tables déclarées) ; base inchangée ligne pour ligne après exécutions, pannes et coupures', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('receptions', { id: 'reception-1', idEmission: 'e1' });
  await magasin.ecrire('faits', { cle: 'moi|nom', sujet: 'moi', relation: 'nom', valeur: 'Christophe' });
  const appels = [];
  const espion = new Proxy(magasin, { get: (o, k) => (typeof o[k] === 'function' ? (...a) => { appels.push(k); return o[k](...a); } : o[k]) });
  const photo = async () => JSON.stringify(await Promise.all(TABLES.map((t) => magasin.lireTout(t))));
  const avant = await photo();
  const m = monter({ magasin: espion });
  await m.porte.activer(ID);
  await m.tour();
  await m.porte.executerMaintenant(ID, { epreuve: 'panne' });
  await m.porte.activer(ID);
  await m.porte.executerMaintenant(ID, { epreuve: 'forme' });
  await m.porte.activer(ID);
  await m.tour();
  m.porte.couper(ID);
  await m.tour();
  assert.equal(await photo(), avant);
  assert.deepEqual([...new Set(appels)], ['lireTout']);
  assert.deepEqual((await m.zone.lire(ID)).map((l) => l.donnees), [{ numero: 1, receptions: 1 }, { numero: 2, receptions: 1 }]);
});
test('sauvegarde de Naissance : identique avec ou sans données d\'essai (zone séparée, état local jamais exporté) ; schéma inchangé', async () => {
  assert.equal(VERSION_BASE, 30);
  assert.equal(SCHEMA_SAUVEGARDE, 20);
  assert.equal(TABLES.length, 36);
  const magasinLangage = magasinMemoireVive();
  await magasinLangage.ecrire('receptions', { id: 'reception-1' });
  const memoire = { exporter: async () => ({ messages: [], souvenirs: [] }), exporterTout: async () => ({}) };
  const faire = async () => {
    try {
      return JSON.stringify(await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'n', versionAppli: '0.66.8', maintenant: '2026-10-25T18:00:00Z' }));
    } catch (e) {
      return `échec:${e.message}`;
    }
  };
  const sans = await faire();
  const m = monter({ magasin: magasinLangage });
  await m.porte.activer(ID);
  await m.tour();
  await m.tour();
  assert.equal((await m.zone.lireTout()).length, 2);
  const avec = await faire();
  assert.equal(avec, sans);
  assert.ok(!avec.includes('temoin-porte'));
  assert.ok(!avec.includes(R.CLE_REGISTRE));
});
test('bac du navigateur : indisponible sans Worker ; un Worker qui ne répond pas est terminé au délai ; une coupure le termine aussitôt', async () => {
  assert.equal(bacWorker({ Fabrique: undefined }).disponible, false);
  const termines = [];
  class FauxWorker {
    constructor(url, opts) { this.url = url; this.opts = opts; }
    postMessage(m) { this.recu = m; }
    terminate() { termines.push(this.url); }
  }
  const b = bacWorker({ urlBac: 'bac', Fabrique: FauxWorker });
  assert.equal(b.disponible, true);
  const t1 = b.executer({ module: './temoin-porte.js', entree: {}, delaiMs: 20 });
  assert.deepEqual(await t1.promesse, { type: 'delai' });
  const t2 = b.executer({ module: './temoin-porte.js', entree: {}, delaiMs: 5000 });
  t2.annuler();
  assert.deepEqual(await t2.promesse, { type: 'annule' });
  assert.equal(termines.length, 2);
  class Refuse { constructor() { throw new Error('module workers non pris en charge'); } }
  assert.match((await bacWorker({ Fabrique: Refuse }).executer({ module: 'x', entree: {}, delaiMs: 10 }).promesse).message, /bac impossible/);
});
