// v0.64.5 — RELATION FONDATRICE STRUCTURÉE (décision ChatGPT « DÉCISION v0.64.5 », 13/10/2026).
// Chaque attente conditionnée porte, calculée à K0, relation = { domaine, connu, attendu } (description) à côté de la fondation (preuve) ;
// transport attente → issue → expérience ; immutabilité ; domaines distincts ; conflit observable ; persistance stricte ; gardes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { experiencesDAttentes, elementsDExperiences, regrouperExperiences } from '../app/langage/experiences-attentes.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerAttenteProspective } from '../app/langage/connaissances.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';

// Monde réel ; avant chaque message, repos jusqu'au plafond (comme le protocole du téléphone).
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
  async function repos() { for (let c = await lireCapacite(magasin); c.valeur < 3; c = await lireCapacite(magasin)) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  async function message(texte, idEmission = null, operation = 'symbolesDeChaine') {
    await repos();
    const avant = (await magasin.lireTout('emissions')).length;
    await tour(texte, idEmission);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).slice(avant).filter((e) => ex.find((q) => q.id === e.idExecution).operation === operation).at(-1);
  }
  async function experiences() {
    const v = await lireExecutionsVecues(magasin);
    return experiencesDAttentes(await magasin.lireTout('attentesProspectives'), await magasin.lireTout('contextesProspectifs'), v.valeurs, v.executions, v.descriptions);
  }
  return { magasin, message, experiences };
}

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { issuesDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { attentesConditionneesDesContextes } from '../app/langage/attentes-conditionnees.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const S2 = (op) => [{ operation: op, entrees: [op === 'symbolesDeChaine' ? 'chaine' : 'valeur'] }, { operation: 'environnement:conversation', entrees: ['emis'] }];
const R_K9 = (op) => ({ domaine: S2(op), connu: { valeurs: { depart: 'K9' } }, attendu: { valeurs: { arrivee: '77' } } });
async function histoire(paires) { // paires [x, y, opération à laquelle on répond]
  const w = monde(); const E = {};
  for (const [x, y, op = 'symbolesDeChaine'] of paires) { const e = await w.message(x, null, op); E[`${x}>${y}>${op}`] = e; await w.message(y, e.id); }
  return { w, E };
}
const conditionnees = async (w) => (await w.magasin.lireTout('attentesProspectives')).filter((a) => Object.hasOwn(a, 'fondation'));

test('CONTRAT : toute attente conditionnée porte relation { domaine, connu, attendu } ; domaine = attente.structure ; aucune identité, horodatage, couverture ni témoin ; aucune attente .74 n’en porte', async () => {
  const w = monde();
  for (const [x, y] of [['K9', '77'], ['Q4', '55']]) { const e = await w.message(x); await w.message(y, e.id); }
  const E = await w.message('K9');
  const lignes = await w.magasin.lireTout('attentesProspectives');
  assert.ok(lignes.filter((a) => a.fondation).length > 0);
  for (const a of lignes) {
    assert.equal(Object.hasOwn(a, 'relation'), Object.hasOwn(a, 'fondation'), 'relation ⇔ fondation');
    if (!a.relation) continue;
    assert.deepEqual(Object.keys(a.relation), ['domaine', 'connu', 'attendu']);
    assert.deepEqual(a.relation.domaine, a.structure);
    const texte = JSON.stringify(a.relation);
    assert.equal(/-\d{10,}|T\d\d:\d\d|reception-|execution-operation|valeur-donnee/.test(texte), false, texte);
  }
  const k9 = lignes.find((a) => a.idDesignation === E.id && a.fondation && a.chemin.join('.') === 'valeurs.arrivee' && a.structure[0].operation === 'symbolesDeChaine');
  assert.deepEqual(k9.relation, R_K9('symbolesDeChaine'));
});

test('K0 / K1 : la relation est un instantané ; de nouveaux épisodes rendent le recalcul différent, l’attente K0, son issue et son expérience portent toujours exactement R', async () => {
  const w = monde();
  for (const [x, y] of [['K9', '77'], ['Q4', '55']]) { const e = await w.message(x); await w.message(y, e.id); }
  const E = await w.message('K9');
  const a0 = (await conditionnees(w)).find((a) => a.idDesignation === E.id && a.chemin.join('.') === 'valeurs.arrivee');
  const R0 = structuredClone(a0.relation);
  await w.message('77', E.id);
  // histoire ajoutée : K9 → 88 casse la classe K9 ↔ 77 ; un recalcul ACTUEL pour ce contexte ne la retrouve plus
  const E2 = await w.message('K9'); await w.message('88', E2.id); await w.message('Q4');
  const v = await lireExecutionsVecues(w.magasin);
  const ctx = (await w.magasin.lireTout('contextesProspectifs')).find((c) => c.id === a0.idContexte);
  const recalcul = attentesConditionneesDesContextes([ctx], { id: E.id, horodatage: new Date().toISOString() }, v.valeurs, v.executions, v.descriptions, episodesDeTransformation(v.valeurs, v.executions, v.descriptions));
  assert.equal(recalcul[0].attentes.some((x) => x.chemin.join('.') === 'valeurs.arrivee' && JSON.stringify(x.relation) === JSON.stringify(R0)), false, 'le recalcul actuel diffère');
  const a1 = (await conditionnees(w)).find((a) => a.id === a0.id);
  assert.deepEqual(a1.relation, R0);
  const issues = issuesDeLAttenteProspective(a1, ctx, v.valeurs, v.executions, v.descriptions);
  assert.deepEqual(issues.map((i) => i.relation), [R0]);
  const exp = (await w.experiences()).experiences.find((x) => x.id === a0.id);
  assert.deepEqual(exp.avant.relation, R0);
  assert.equal(exp.apres.statut, 'realisee');
});

test('PERMUTATIONS : ordre des épisodes d’entrée inversé — mêmes relations (aucun indice de collection n’y reçoit de sens)', async () => {
  const w = monde();
  for (const [x, y] of [['K9', '77'], ['K9', '77'], ['Q4', '55']]) { const e = await w.message(x); await w.message(y, e.id); }
  const E = await w.message('K9');
  const v = await lireExecutionsVecues(w.magasin);
  const ctxs = (await w.magasin.lireTout('contextesProspectifs')).filter((c) => c.idDesignation === E.id);
  const d = { id: E.id, horodatage: E.horodatage };
  const vue = episodesDeTransformation(v.valeurs, v.executions, v.descriptions);
  const rel = (vueX) => attentesConditionneesDesContextes(ctxs, d, v.valeurs, v.executions, v.descriptions, vueX).flatMap((s) => s.attentes.map((a) => a.relation));
  const ref = rel(vue);
  assert.ok(ref.length > 0);
  assert.deepEqual(rel({ episodes: [...vue.episodes].reverse() }), ref);
  const k9 = (await conditionnees(w)).find((a) => a.idDesignation === E.id && a.chemin.join('.') === 'valeurs.arrivee' && a.structure[0].operation === 'symbolesDeChaine');
  assert.equal(k9.fondation[0].couverture.length, 2, 'deux témoins, une seule projection attendue');
  assert.deepEqual(k9.relation, R_K9('symbolesDeChaine'));
});

test('DOMAINES DISTINCTS (E1 / E4) : mêmes valeurs K9 → 77 dans deux familles (symbolesDeChaine / parcourirStructure → conversation) : relations différentes UNIQUEMENT par le domaine', async () => {
  const w = monde();
  for (const [x, y, op] of [['K9', '77', 'symbolesDeChaine'], ['Q4', '55', 'symbolesDeChaine'], ['K9', '77', 'parcourirStructure'], ['Q4', '55', 'parcourirStructure']]) { const e = await w.message(x, null, op); await w.message(y, e.id); }
  const E = await w.message('K9');
  const deux = (await conditionnees(w)).filter((a) => a.idDesignation === E.id && a.chemin.join('.') === 'valeurs.arrivee');
  const e1 = deux.find((a) => a.structure[0].operation === 'symbolesDeChaine');
  const E4 = await w.message('K9', null, 'parcourirStructure');
  const e4 = (await conditionnees(w)).find((a) => a.idDesignation === E4.id && a.chemin.join('.') === 'valeurs.arrivee');
  assert.deepEqual(e1.relation, R_K9('symbolesDeChaine'));
  assert.deepEqual(e4.relation, R_K9('parcourirStructure'));
  assert.notDeepEqual(e1.relation, e4.relation);
  assert.deepEqual([e1.relation.connu, e1.relation.attendu], [e4.relation.connu, e4.relation.attendu]);
});

test('MÊME RELATION, ISSUES CONTRADICTOIRES : un groupe R (regrouperExperiences([avant.relation])) ; constatsParChemin sur apres.statut : réalisée ×2, autre ×1 — rien n’est résolu', async () => {
  const w = monde();
  for (const [x, y] of [['K9', '77'], ['Q4', '55'], ['K9', '77'], ['K9', '77'], ['K9', '99']]) { const e = await w.message(x); await w.message(y, e.id); }
  const { experiences } = await w.experiences();
  const R = R_K9('symbolesDeChaine');
  const groupes = regrouperExperiences(experiences.filter((e) => e.avant.relation), [['avant', 'relation']]);
  const g = groupes.find((x) => JSON.stringify(x.cle[0]) === JSON.stringify(R));
  assert.ok(g);
  const statuts = constatsParChemin(elementsDExperiences(g.experiences)).chemins.find((c) => JSON.stringify(c.chemin) === '["apres","statut"]').constats;
  assert.deepEqual(statuts.map((s) => [s.valeur, s.couverture.length]).sort(), [['autre', 1], ['realisee', 2]]);
  assert.equal(g.couverture.length, 3);
});

test('PERSISTANCE : `relation` accompagne une fondation, forme { domaine, connu, attendu } stricte ; refus sinon ; copie sans transformation', async () => {
  const magasin = magasinMemoireVive();
  const designation = { id: 'des-1', idObservation: 'obs-1' }; const contexte = { id: 'ctx-1', idDesignation: 'des-1' };
  const base = { idContexte: 'ctx-1', idDesignation: 'des-1', structure: [{ operation: 'f', entrees: ['e'] }], chemin: ['r'], constat: { type: 'chaine', valeur: 'w' }, temoinsContexte: [['d1', 'a1', 'a1']], unitesIssues: [['d1', 'a1', 'a1']] };
  const fondation = [{ couverture: [['d1', 'a1', 'a1']], constats: [{ chemin: ['p'], type: 'chaine', valeur: 'u' }, { chemin: ['r'], type: 'chaine', valeur: 'w' }], conditions: [{ chemin: ['p'], type: 'chaine', valeur: 'u' }] }];
  const relation = { domaine: [{ operation: 'f', entrees: ['e'] }], connu: { p: 'u' }, attendu: { r: 'w' } };
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation, contexte, attente: { ...base, relation } }), TypeError, 'jamais sans fondation');
  for (const mauvaise of [{}, { ...relation, score: 1 }, { ...relation, domaine: [] }, { ...relation, connu: [] }, { domaine: relation.domaine, connu: relation.connu }, null]) {
    await assert.rejects(enregistrerAttenteProspective(magasin, { designation, contexte, attente: { ...base, fondation, relation: mauvaise } }), TypeError, JSON.stringify(mauvaise));
  }
  const ok = await enregistrerAttenteProspective(magasin, { designation, contexte, attente: { ...base, fondation, relation } });
  assert.deepEqual(ok.relation, relation); assert.notEqual(ok.relation, relation);
});

test('GARDES : seuls attentes-conditionnees (production), connaissances (persistance), issue-attente-prospective et experiences-attentes (transport) nomment `relation.` ou le champ relation ; aucun mécanisme de décision ne le lit', () => {
  // `relation` désigne aussi l'état relationnel B2 (relation.js) : la garde vise exactement les accès au champ d'attente / d'expérience.
  const MOTIF = /relationFondatrice|CHAMP_RELATION|avant\.relation|base\.relation|hasOwn\((attente|issue), 'relation'\)|\brelation: relationFondatrice/;
  const fichiers = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiers(p) : p.endsWith('.js') ? [p] : []; });
  const lecteurs = [];
  for (const f of fichiers(join(RACINE, 'app'))) {
    const code = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    if (MOTIF.test(code)) lecteurs.push(f.slice(RACINE.length + 1));
  }
  assert.deepEqual(lecteurs.sort(), ['app/langage/attentes-conditionnees.js', 'app/langage/connaissances.js', 'app/langage/experiences-attentes.js', 'app/langage/issue-attente-prospective.js']);
  for (const nom of ['besoins', 'episode-propre', 'tick-propre', 'execution-mecanique', 'applications-sollicitables', 'capacite', 'relation', 'prospection-soi', 'environnement-conversation', 'execution-sollicitee', 'attentes-prospectives']) {
    const code = readFileSync(join(RACINE, 'app', 'langage', `${nom}.js`), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.equal(MOTIF.test(code), false, nom);
  }
});
