// v0.63.98 — RÉUTILISATION DE LA VUE DES ÉPISODES (décision ChatGPT « DÉCISION APRÈS REFUS DU ROBOT », 12/10/2026).
// Une vue des épisodes par vécu réellement distinct, transmise explicitement ; sorties identiques. Le COMPTEUR vit ici, dans le harnais : un espion
// sur lignesValeurs compte les lectures de `length`, et l'étalon est le nombre de lectures d'UN calcul de la vue. Aucun compteur en production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { issueDuContexteProspectif, issuesDuContexteProspectif, issuesDuContexteProspectifSurVue } from '../app/langage/issue-contexte-prospectif.js';
import { issuesDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError);

function monde() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); await consequenceReception(magasin, d.reception); await traiterOccasion(magasin, d.reception.id); }
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function emettre(texte) {
    const s = await tour(texte);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).filter((m) => m.idObservation === s.observation.id).find((m) => ex.find((q) => q.id === m.idExecution).operation === 'symbolesDeChaine');
  }
  async function tick(k) { for (let i = 0; i < k; i += 1) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  return { magasin, tour, emettre, tick };
}
// Vécu critique : trois émissions ayant chacune DEUX réponses (deux issues par contexte antérieur), puis une émission présente.
let VECU = null;
async function vecu() {
  if (VECU) return VECU;
  const w = monde();
  for (const [x, y] of [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui']]) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tour(`${y}!`, E.id); await w.tick(4); }
  const E = await w.emettre('salut');
  const v = await lireExecutionsVecues(w.magasin);
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  VECU = { w, E, v, contextes, attentes: await w.magasin.lireTout('attentesProspectives') };
  return VECU;
}
// Espion du HARNAIS : compte les lectures de `length` sur lignesValeurs ; étalon = lectures d'un calcul complet de la vue.
function espion() {
  const etat = { n: 0 };
  return { etat, envelopper: (t) => new Proxy(t, { get(o, k, r) { if (k === 'length') etat.n += 1; return Reflect.get(o, k, r); } }) };
}
async function etalon() {
  const { v } = await vecu();
  const e = espion(); episodesDeTransformation(e.envelopper(v.valeurs), v.executions, v.descriptions);
  assert.ok(e.etat.n > 0);
  return e.etat.n;
}

test('COMPTEUR .74 : UN seul calcul de la vue par appel (au lieu d’un par issue antérieure), mêmes attentes', async () => {
  const { E, v, contextes, attentes } = await vecu();
  const parVue = await etalon();
  const c = contextes.find((x) => x.idDesignation === E.id && x.structure.length === 2);
  const e = espion();
  const sortie = attentesDuContexteProspectif(c, { id: E.id, horodatage: E.horodatage }, contextes, e.envelopper(v.valeurs), v.executions, v.descriptions);
  assert.equal(e.etat.n, parVue, 'exactement un calcul de la vue pour ce vécu');
  // ce que l'ancien chemin aurait coûté : une vue par issue admissible antérieure
  const anterieures = contextes.filter((x) => x.idDesignation !== E.id && JSON.stringify(x.structure) === JSON.stringify(c.structure)).flatMap((x) => v.executions.filter((q) => q.idDesignation === x.idDesignation && q.horodatage <= E.horodatage));
  assert.ok(anterieures.length >= 6, `issues antérieures : ${anterieures.length}`);
  // mêmes attentes que celles persistées par le flux réel (calculées au même instant sur le même vécu « avant »)
  const persistees = attentes.filter((a) => a.idContexte === c.id).map(({ id, horodatage, idObservation, ...reste }) => reste);
  assert.deepEqual(sortie, persistees);
});

test('COMPTEUR .74 : aucune issue antérieure admissible → la vue n’est jamais calculée (comme avant)', async () => {
  const { E, v, contextes } = await vecu();
  const c = contextes.find((x) => x.idDesignation === E.id && x.structure.length === 2);
  const e = espion();
  attentesDuContexteProspectif(c, { id: E.id, horodatage: '2000-01-01T00:00:00.000Z' }, contextes, e.envelopper(v.valeurs), v.executions, v.descriptions);
  assert.equal(e.etat.n, 0);
});

test('ÉQUIVALENCE : issuesDuContexteProspectif = issuesDuContexteProspectifSurVue = ancres singulières, pour TOUS les contextes du vécu ; une seule vue par appel pluriel', async () => {
  const { v, contextes } = await vecu();
  const parVue = await etalon();
  const vue = episodesDeTransformation(v.valeurs, v.executions, v.descriptions);
  let multiples = 0;
  for (const c of contextes) {
    const e = espion();
    const pluriel = issuesDuContexteProspectif(c, e.envelopper(v.valeurs), v.executions, v.descriptions);
    assert.ok(e.etat.n === 0 || e.etat.n === parVue, 'au plus un calcul de la vue');
    assert.deepEqual(issuesDuContexteProspectifSurVue(c, v.executions, vue), pluriel);
    assert.deepEqual(pluriel, pluriel.map((i) => issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions, i.issue.idExecution)));
    if (pluriel.length > 1) multiples += 1;
  }
  assert.ok(multiples >= 3, 'des contextes à deux issues sont couverts');
});

test('DOUBLE RÉPONSE : deux issues par émission, unités [C, R1, …] et [C, R2, …] dans les attentes persistées ; issues d’attente intactes', async () => {
  const { v, contextes, attentes } = await vecu();
  const avecDeux = attentes.filter((a) => { const ids = new Set(a.unitesIssues.map((u) => u[0])); return [...ids].some((id) => a.unitesIssues.filter((u) => u[0] === id).length === 2); });
  assert.ok(avecDeux.length > 0, 'des attentes fondées sur deux conséquences d’un même contexte');
  const a = attentes.find((x) => x.chemin.join('.') === 'relationValeur');
  const c = contextes.find((x) => x.id === a.idContexte);
  const issues = issuesDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions);
  assert.equal(issues.length >= 1, true);
});

test('API : vueEpisodes mal formée → TypeError ; issueDuContexteProspectif historique inchangée (contrat 0 / 1 / plusieurs)', async () => {
  const { v, contextes } = await vecu();
  for (const mauvaise of [null, {}, { episodes: 'x' }, []]) refuse(() => issuesDuContexteProspectifSurVue(contextes[0], v.executions, mauvaise));
  const double = contextes.find((c) => v.executions.filter((e) => e.idDesignation === c.idDesignation).length === 2);
  refuse(() => issueDuContexteProspectif(double, v.valeurs, v.executions, v.descriptions));
});

test('GARDES : aucun cache, aucun état de module, aucune WeakMap ; la vue n’est passée qu’explicitement', () => {
  for (const nom of ['issue-contexte-prospectif', 'attentes-prospectives']) {
    const src = readFileSync(join(RACINE, 'app', 'langage', `${nom}.js`), 'utf8');
    const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.equal(/WeakMap|WeakRef|globalThis|\bcache\b/i.test(code), false, nom);
    const horsFonctions = code.split('\n').filter((l) => /^(let|var) /.test(l));
    assert.deepEqual(horsFonctions, [], `${nom} : aucune variable de module`);
  }
});
