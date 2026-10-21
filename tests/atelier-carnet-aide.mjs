// v0.65.18 — AT-10.1 : données communes des tests du carnet (proposition fictive de trois missions, chantier de mission, registre).
// OUTILLAGE NON COGNITIF — aucune acquisition. Aucun appel réseau : les montants sont fictifs, en microdollars.
import { ouvrirCarnet, appliquerCarnet, chantierDeMission } from '../app/atelier/carnet.js';
import { ouvrirChantier, appliquer } from '../app/atelier/chantier.js';
import { ouvrirRegistre, appliquerBudget } from '../app/atelier/budget.js';

export const Q = '2026-10-21T12:00:00Z';
export const BASE = Object.freeze({ sha: 'a'.repeat(40), version: '0.65.17' });
export const CARNET = 'carnet-essai';

// Appel borné : 10 000 jetons d'entrée au plus, 2 048 de sortie, tarifs fictifs de 5 $ et 25 $ par million de jetons (en microdollars).
// Coût maximal = 10000 x 5 + 2048 x 25 = 50000 + 51200 = 101200 microdollars, sous le plafond de 150 000.
export const APPEL = Object.freeze({ appels: 1, entree_max: 10000, max_tokens: 2048, modele: 'claude-opus-5-5', tarif_entree: 5000000, tarif_sortie: 25000000 });
export const DEV = Object.freeze({ effort: 'low', extraits: [], tarif_entree: 5000000, tarif_sortie: 25000000 });

export function mission(k, change = {}) {
  return {
    appel: { ...APPEL }, autorises: [`app/atelier/essai-${k}.js`, `tests/atelier-essai-${k}.test.mjs`],
    criteres: [`Le module essai-${k} rend la valeur attendue.`], decisions: [], developpement: structuredClone(DEV),
    frontieres: ['Aucun changement cognitif.'], interdits: [],
    jalon: { comportement: `Le module essai-${k} existe et son test passe.`, critere: `Test essai-${k} vert.`, id: `essai-${k}`, titre: `Essai ${k}` },
    objectif: `Mission ${k} du carnet fictif : ajouter le module essai-${k}.`, plafond: 150000, tests: [`tests/atelier-essai-${k}.test.mjs`],
    ...change,
  };
}

export function proposition(change = {}) {
  return {
    base: { ...BASE }, carnet: CARNET, limite_espace: 1000000, missions: [mission(1), mission(2), mission(3)],
    objectif: 'Carnet fictif de trois missions (recette locale AT-10.1).', plafond_total: 1000000, protocole: 'atelier-carnet-proposition-1',
    ...change,
  };
}

export const ev = (type, donnees = {}) => ({ type, quand: Q, donnees });

// Applique une suite d'événements au carnet ; lève au premier refus.
export function suite(journal, ...evs) {
  let j = journal;
  for (const e of evs) {
    const r = appliquerCarnet(j, e);
    if (!Array.isArray(r)) throw new Error(`refus inattendu (${e.type}) : ${r.raison}`);
    j = r;
  }
  return j;
}

export const sha = (c) => c.repeat(40);
export const livraison = (k, change = {}) => ({
  candidat: sha(String.fromCharCode(97 + k)), carnet: CARNET, chantier: chantierDeMission(CARNET, k), cout: 100000, k,
  main: sha(String(k)), preuve: String(k).repeat(64), version: `0.65.${17 + k}`, ...change,
});
export const baseDe = (k) => (k === 1 ? { ...BASE } : { sha: sha(String(k - 1)), version: `0.65.${16 + k}` });
export const ouverte = (k) => ev('mission-ouverte', { k, chantier: chantierDeMission(CARNET, k), base: baseDe(k) });

export function approuve(p = proposition()) {
  const j = ouvrirCarnet(p, Q);
  return { j, p };
}

// Chantier AT-1 de la mission k conforme au carnet, mené jusqu'à l'acceptation du candidat ; registre AT-2 avec un coût payé.
export function chantierMission(k, { base = baseDe(k), accepter = true, montant = 100000, payer = true, change = {}, candidat = sha(String.fromCharCode(97 + k)) } = {}) {
  const m = mission(k);
  let j = ouvrirChantier({ id: chantierDeMission(CARNET, k), objectif: m.objectif, base, plan: [{ id: m.jalon.id, titre: m.jalon.titre, critere: m.jalon.critere, tentativesMax: 1 }], ...change }, Q);
  const pas = (type, donnees) => { const r = appliquer(j, { type, quand: Q, donnees }); if (!Array.isArray(r)) throw new Error(r.raison); j = r; };
  pas('plan-approuve', {});
  pas('tentative-lancee', { jalon: m.jalon.id });
  pas('tentative-rendue', { jalon: m.jalon.id, numero: 1, reference: `atelier/x@${sha('c')}` });
  if (accepter) pas('tentative-acceptee', { jalon: m.jalon.id, numero: 1, motif: 'ok', candidat });
  let r = ouvrirRegistre({ cycle: '2026-10', plafond: 1000000, reserve: 0, plafondRun: 500000 }, Q);
  const b = (type, donnees) => { const x = appliquerBudget(r, { type, quand: Q, donnees }); if (!Array.isArray(x)) throw new Error(x.raison); r = x; };
  b('chantier-plafonne', { chantier: chantierDeMission(CARNET, k), plafond: m.plafond });
  b('engagement', { execution: `${chantierDeMission(CARNET, k)}-t1`, chantier: chantierDeMission(CARNET, k), maximum: 101200 });
  if (payer) b('cout', { execution: `${chantierDeMission(CARNET, k)}-t1`, montant, issue: 'reponse-connue' });
  return { journal: j, registre: r };
}
