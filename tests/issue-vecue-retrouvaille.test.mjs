// v0.66.5 — C1 « ISSUE VÉCUE D'UNE RETROUVAILLE » (jalon issue-vecue-ecrivain) : écrivain/lecteur de la table issuesRetrouvailles
// (connaissances.js) et module issues-vecues.js (conserverIssuesVecues). Le vécu est produit par le VRAI flux (harnais de
// tests/issue-retrouvaille.test.mjs : tours, ticks, capacité), recopié à l'identique ; rien n'est branché dans l'application à cette étape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerIssueRetrouvaille, lireIssuesRetrouvailles, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { lireCapacite, peutAgir, tourActif, PARAMETRES_B1 } from '../app/langage/capacite.js';
import { emettreLot } from '../app/langage/environnement-conversation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { confronterRetrouvaille } from '../app/langage/issue-retrouvaille.js';
import { conserverIssuesVecues } from '../app/langage/issues-vecues.js';
import * as MODULE from '../app/langage/issues-vecues.js';
import { construireSauvegardeComplete, lireSauvegardeComplete } from '../app/memoire/sauvegarde.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { creerMagasinMemoire } from '../app/memoire/magasin.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const T = 'issuesRetrouvailles';
const ARRIVEE_1 = { valeurs: { arrivee: 1 } };

// ---------------------------------------------------------------------------------------------------------------- vécu réel (harnais recopié)
// v0.66.5 (jalon issue-vecue-producteurs) : options facultatives, sans effet sur le flux — `journal` (chaque écriture, dans l'ordre réel,
// APRÈS son effet : { table, id }), `magasin` (reprendre un magasin existant) et `marque` (préfixe distinct des identités du pont).
function monde({ journal = null, magasin: base = null, marque = 'c1' } = {}) {
  const magasin = base ?? magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${marque}-${++n}`;
  if (journal) {
    const ecrire = magasin.ecrire.bind(magasin); const atomique = magasin.ecrireAtomique.bind(magasin);
    magasin.ecrire = async (t, o) => { const r = await ecrire(t, o); journal.push({ table: t, id: o.id }); return r; };
    magasin.ecrireAtomique = async (ops) => { const r = await atomique(ops); for (const o of ops) journal.push({ table: o.table, id: o.objet.id }); return r; };
  }
  async function tour(texte, cout = PARAMETRES_B1.coutTourActif) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage }, { ...PARAMETRES_B1, coutTourActif: cout });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function tick(k) { for (let i = 0; i < k; i += 1) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  async function etape([genre, x, cout]) {
    const avant = new Set((await magasin.lireTout('contextesProspectifs')).map((c) => c.id));
    if (genre === 'msg') await tour(x, cout); else await tick(x);
    return (await magasin.lireTout('contextesProspectifs')).filter((c) => !avant.has(c.id));
  }
  return { magasin, etape };
}
const SCENARIO = [['msg', 'bonjour'], ['msg', 'salut'], ['tick', 3], ['msg', 'un'], ['msg', 'deux'], ['tick', 3], ['msg', 'trois'], ['msg', 'quatre'], ['tick', 3], ['msg', 'cinq'], ['msg', 'six'], ['msg', 'sept']];
async function vivre(plan, options) {
  const w = monde(options); const etapes = [];
  for (const p of plan) etapes.push({ etiquette: p[1], contextes: await w.etape(p) });
  return { w, etapes };
}
let partage = null;
const JOURNAL = [];
const vecuPartage = () => (partage ??= vivre(SCENARIO, { journal: JOURNAL })); // lecture seule : chaque test travaille sur une copie (redemarrer)
const tourDe = (etapes, etiquette) => etapes.find((e) => e.etiquette === etiquette).contextes.find((c) => vue(c.structure) === 'soi:tour(etat)');
async function redemarrer(magasin, modifier = (d) => d) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await magasin.lireTout(t)));
  const neuf = magasinMemoireVive();
  await neuf.remplacerTout(modifier(donnees));
  return neuf;
}
// MISE À JOUR DÉLIBÉRÉE v0.66.5 (jalon issue-vecue-producteurs) : depuis le branchement, le VRAI flux écrit lui-même les issues vécues au moment
// des conséquences. C1–C3 examinent conserverIssuesVecues ISOLÉMENT : ils travaillent sur une copie dont SEULE la table issuesRetrouvailles est
// vidée (toutes les autres lignes identiques), pour observer ce que CET appel écrit. Aucune assertion n'est affaiblie.
const sansIssuesVecues = (d) => ({ ...d, [T]: [] });
// Magasin instrumenté : journal des lectures et des écritures (tables), sans rien changer à leur effet.
function espionner(magasin) {
  const journal = [];
  return {
    journal,
    magasin: {
      ...magasin,
      lireTout: async (t) => { journal.push(['lire', t]); return magasin.lireTout(t); },
      ecrire: async (t, o) => { journal.push(['ecrire', t]); return magasin.ecrire(t, o); },
      ecrireAtomique: async (ops) => { journal.push(['ecrireAtomique', ops.map((o) => [o.table, o.mode])]); return magasin.ecrireAtomique(ops); },
    },
  };
}
const ligneValide = (patch = {}) => ({ id: 'issue-retrouvaille/contexte-a/execution-b', idContexte: 'contexte-a', idDesignation: 'acte-a', idExecution: 'execution-b', horodatage: '2026-10-25T10:00:00.000Z', observe: { statut: 'realisee', reel: ARRIVEE_1 }, ...patch });

// ================================================================================================================ écrivain / lecteur
test('E1. écriture atomique en mode ajout, relecture exacte, refus d\'un id déjà présent (rien de changé)', async () => {
  const { magasin, journal } = espionner(magasinMemoireVive());
  assert.deepEqual(await lireIssuesRetrouvailles(magasin), []);
  const a = ligneValide();
  const b = ligneValide({ id: 'issue-retrouvaille/contexte-c/execution-d', idContexte: 'contexte-c', idExecution: 'execution-d', observe: { statut: 'absente' } });
  const ea = await enregistrerIssueRetrouvaille(magasin, a);
  const eb = await enregistrerIssueRetrouvaille(magasin, b);
  assert.deepEqual(ea, a); assert.deepEqual(eb, b);
  assert.deepEqual(Object.keys(ea), ['id', 'idContexte', 'idDesignation', 'idExecution', 'horodatage', 'observe']);
  assert.notEqual(ea.observe.reel, a.observe.reel, 'copie : la ligne écrite ne partage rien avec l\'entrée');
  assert.deepEqual(journal.filter((j) => j[0] !== 'lire'), [['ecrireAtomique', [[T, 'ajout']]], ['ecrireAtomique', [[T, 'ajout']]]], 'uniquement des ajouts atomiques');
  const relues = await lireIssuesRetrouvailles(magasin);
  assert.deepEqual(new Map(relues.map((l) => [l.id, l])), new Map([[a.id, a], [b.id, b]]));
  await assert.rejects(enregistrerIssueRetrouvaille(magasin, { ...a, observe: { statut: 'autre', reel: { valeurs: { arrivee: 0 } } } }), /existe déjà dans issuesRetrouvailles/);
  assert.deepEqual(new Map((await lireIssuesRetrouvailles(magasin)).map((l) => [l.id, l])), new Map([[a.id, a], [b.id, b]]), 'la ligne existante est immuable');
  // redémarrage : relecture identique
  const neuf = await redemarrer(magasin);
  assert.deepEqual(new Map((await lireIssuesRetrouvailles(neuf)).map((l) => [l.id, l])), new Map([[a.id, a], [b.id, b]]));
});

test('E2. forme invalide refusée (TypeError), rien n\'est écrit', async () => {
  const magasin = magasinMemoireVive();
  const sansCle = (k) => { const l = ligneValide(); delete l[k]; return l; };
  const cas = [
    null, 'ligne', [ligneValide()],
    sansCle('horodatage'), sansCle('idDesignation'), sansCle('observe'),
    ligneValide({ score: 1 }),
    ligneValide({ idContexte: '' }), ligneValide({ idExecution: 3 }), ligneValide({ horodatage: null }),
    ligneValide({ id: 'issue-retrouvaille/autre/execution-b' }), ligneValide({ id: 'contexte-a/execution-b' }),
    ligneValide({ observe: null }), ligneValide({ observe: { statut: 'reussie', reel: ARRIVEE_1 } }),
    ligneValide({ observe: { statut: 'realisee' } }), ligneValide({ observe: { statut: 'autre' } }),
    ligneValide({ observe: { statut: 'absente', reel: ARRIVEE_1 } }), ligneValide({ observe: { statut: 'incomplete', reel: ARRIVEE_1 } }),
    ligneValide({ observe: { statut: 'realisee', reel: ARRIVEE_1, confiance: 1 } }),
    ligneValide({ observe: { statut: 'realisee', reel: undefined } }),
  ];
  for (const l of cas) await assert.rejects(enregistrerIssueRetrouvaille(magasin, l), TypeError, JSON.stringify(l));
  assert.deepEqual(await magasin.lireTout(T), []);
  for (const statut of ['absente', 'incomplete']) assert.equal((await enregistrerIssueRetrouvaille(magasin, ligneValide({ id: `issue-retrouvaille/contexte-a/${statut}`, idExecution: statut, observe: { statut } }))).observe.statut, statut);
  assert.equal((await magasin.lireTout(T)).length, 2);
});

// ================================================================================================================ conserverIssuesVecues
test('C1. aucun contexte retrouvee pour l\'acte → seule contextesProspectifs est lue : ni vécu, ni confrontation, aucune ligne', async () => {
  // magasin vide
  const vide = espionner(magasinMemoireVive());
  assert.deepEqual(await conserverIssuesVecues(vide.magasin, { idDesignation: 'acte-x', idExecution: 'execution-y' }), []);
  assert.deepEqual(vide.journal, [['lire', 'contextesProspectifs']]);
  // vécu réel : un acte dont AUCUN contexte n'est 'retrouvee' (« deux » : aucune), alors que d'autres actes en ont
  const { w, etapes } = await vecuPartage();
  const copie = await redemarrer(w.magasin, sansIssuesVecues); // MISE À JOUR DÉLIBÉRÉE v0.66.5 (jalon issue-vecue-producteurs) : voir sansIssuesVecues
  const contextes = await copie.lireTout('contextesProspectifs');
  assert.ok(contextes.some((c) => c.retrouvaille && c.retrouvaille.statut === 'retrouvee'), 'des contextes retrouvee existent (autres actes)');
  const deux = tourDe(etapes, 'deux');
  assert.equal(deux.retrouvaille.statut, 'aucune');
  assert.ok(contextes.filter((c) => c.idDesignation === deux.idDesignation).every((c) => c.retrouvaille.statut !== 'retrouvee'));
  const v = await lireExecutionsVecues(copie);
  const issuesDeDeux = v.executions.filter((e) => e.idDesignation === deux.idDesignation);
  assert.ok(issuesDeDeux.length > 0, 'l\'acte a bien une conséquence vécue');
  const s = espionner(copie);
  for (const e of issuesDeDeux) assert.deepEqual(await conserverIssuesVecues(s.magasin, { idDesignation: deux.idDesignation, idExecution: e.id }), []);
  assert.deepEqual(s.journal.filter((j) => j[1] !== 'contextesProspectifs'), [], 'aucune lecture du vécu, aucune écriture');
  assert.deepEqual(await copie.lireTout(T), []);
  // statique : le vécu n'est lu qu'après le test « aucun contexte retenu »
  const code = sansCommentaires(lu('app', 'langage', 'issues-vecues.js'));
  const corps = code.slice(code.indexOf('export async function conserverIssuesVecues'));
  assert.ok(corps.indexOf('if (retenus.length === 0) return ecrites;') >= 0);
  assert.ok(corps.indexOf('if (retenus.length === 0) return ecrites;') < corps.indexOf('lireExecutionsVecues(magasin)'));
  assert.ok(corps.indexOf('lireExecutionsVecues(magasin)') < corps.indexOf('conserverPourContexte('), 'la confrontation ne vient qu\'après la lecture du vécu');
});

test('C2. contexte retrouvee + exécution : UNE ligne par contexte retrouvé de l\'acte, id dérivé, observe = { statut, reel } rendus par confronterRetrouvaille ; relecture identique', async () => {
  const { w, etapes } = await vecuPartage();
  const copie = await redemarrer(w.magasin, sansIssuesVecues); // MISE À JOUR DÉLIBÉRÉE v0.66.5 (jalon issue-vecue-producteurs) : voir sansIssuesVecues
  const six = tourDe(etapes, 'six');
  assert.equal(six.retrouvaille.statut, 'retrouvee');
  const v = await lireExecutionsVecues(copie);
  const confrontation = confronterRetrouvaille(six, v);
  assert.equal(confrontation.aujourdhui.issues.length, 1);
  const [issue] = confrontation.aujourdhui.issues;
  assert.deepEqual({ statut: issue.statut, reel: issue.reel }, { statut: 'realisee', reel: ARRIVEE_1 });
  // attendu : chaque contexte 'retrouvee' de cet acte dont la confrontation rend une issue de cette exécution
  const attendues = (await copie.lireTout('contextesProspectifs'))
    .filter((c) => c.idDesignation === six.idDesignation && c.retrouvaille && c.retrouvaille.statut === 'retrouvee')
    .flatMap((c) => (confronterRetrouvaille(c, v).aujourdhui.issues || []).filter((i) => i.idExecution === issue.idExecution).map((i) => ({ c, i })));
  const s = espionner(copie);
  const ecrites = await conserverIssuesVecues(s.magasin, { idDesignation: six.idDesignation, idExecution: issue.idExecution });
  assert.equal(ecrites.length, attendues.length);
  for (const { c, i } of attendues) {
    const l = ecrites.find((x) => x.idContexte === c.id);
    assert.deepEqual({ ...l, horodatage: 'H' }, {
      id: `issue-retrouvaille/${c.id}/${issue.idExecution}`, idContexte: c.id, idDesignation: six.idDesignation, idExecution: issue.idExecution, horodatage: 'H',
      observe: Object.hasOwn(i, 'reel') ? { statut: i.statut, reel: i.reel } : { statut: i.statut },
    });
    assert.ok(!Number.isNaN(Date.parse(l.horodatage)));
  }
  const ligneSix = ecrites.find((x) => x.idContexte === six.id);
  assert.equal(ligneSix.id, `issue-retrouvaille/${six.id}/${issue.idExecution}`);
  assert.deepEqual(ligneSix.observe, { statut: 'realisee', reel: ARRIVEE_1 });
  assert.deepEqual(Object.keys(ligneSix), ['id', 'idContexte', 'idDesignation', 'idExecution', 'horodatage', 'observe']);
  assert.deepEqual(new Map((await lireIssuesRetrouvailles(copie)).map((l) => [l.id, l])), new Map(ecrites.map((l) => [l.id, l])));
  assert.deepEqual(s.journal.filter((j) => j[0] !== 'lire'), ecrites.map(() => ['ecrireAtomique', [[T, 'ajout']]]), 'écritures : ajouts atomiques dans la seule table issuesRetrouvailles');
  // le groupe retrouvaille et les autres tables sont intacts
  assert.deepEqual(await copie.lireTout('contextesProspectifs'), await w.magasin.lireTout('contextesProspectifs'));
  // second appel identique : l'ajout est refusé (ligne immuable), l'erreur est absorbée, rien ne change
  assert.deepEqual(await conserverIssuesVecues(copie, { idDesignation: six.idDesignation, idExecution: issue.idExecution }), []);
  assert.deepEqual(new Map((await lireIssuesRetrouvailles(copie)).map((l) => [l.id, l])), new Map(ecrites.map((l) => [l.id, l])));
});

test('C3. issue introuvable (autre exécution, acte d\'un autre) → rien ; une erreur interne ne remonte jamais', async () => {
  const { w, etapes } = await vecuPartage();
  const copie = await redemarrer(w.magasin, sansIssuesVecues); // MISE À JOUR DÉLIBÉRÉE v0.66.5 (jalon issue-vecue-producteurs) : voir sansIssuesVecues
  const six = tourDe(etapes, 'six');
  const v = await lireExecutionsVecues(copie);
  const [issue] = confronterRetrouvaille(six, v).aujourdhui.issues;
  assert.deepEqual(await conserverIssuesVecues(copie, { idDesignation: six.idDesignation, idExecution: 'execution-inconnue' }), []);
  const autre = v.executions.find((e) => e.idDesignation !== six.idDesignation);
  assert.deepEqual(await conserverIssuesVecues(copie, { idDesignation: six.idDesignation, idExecution: autre.id }), []);
  assert.deepEqual(await copie.lireTout(T), []);
  // erreurs absorbées : entrée invalide, magasin absent ou en panne (lecture, vécu, écriture)
  const enPanne = (sur) => ({ ...copie, lireTout: async (t) => { if (sur(t)) throw new Error('stockage indisponible'); return copie.lireTout(t); } });
  const cas = [
    [copie, null], [copie, undefined], [copie, { idDesignation: six.idDesignation }], [copie, { idDesignation: '', idExecution: issue.idExecution }],
    [null, { idDesignation: six.idDesignation, idExecution: issue.idExecution }],
    [{}, { idDesignation: six.idDesignation, idExecution: issue.idExecution }],
    [enPanne((t) => t === 'contextesProspectifs'), { idDesignation: six.idDesignation, idExecution: issue.idExecution }],
    [enPanne((t) => t === 'variationsCapacite'), { idDesignation: six.idDesignation, idExecution: issue.idExecution }],
    [{ ...copie, ecrireAtomique: async () => { throw new Error('quota'); } }, { idDesignation: six.idDesignation, idExecution: issue.idExecution }],
    [{ ...copie, lireTout: async (t) => (t === 'contextesProspectifs' ? 'pas un tableau' : copie.lireTout(t)) }, { idDesignation: six.idDesignation, idExecution: issue.idExecution }],
  ];
  for (const [m, e] of cas) assert.deepEqual(await conserverIssuesVecues(m, e), []);
  assert.deepEqual(await copie.lireTout(T), [], 'aucune ligne écrite par un appel en erreur');
  // un contexte au groupe retrouvee hors forme : la confrontation refuse, l'erreur est absorbée, aucune ligne
  const casse = { ...copie, lireTout: async (t) => (t === 'contextesProspectifs' ? (await copie.lireTout(t)).map((c) => (c.id === six.id ? { ...c, retrouvaille: { statut: 'retrouvee' } } : c)) : copie.lireTout(t)) };
  const r = await conserverIssuesVecues(casse, { idDesignation: six.idDesignation, idExecution: issue.idExecution });
  assert.equal(r.some((l) => l.idContexte === six.id), false);
});

// ================================================================================================================ producteurs (v0.66.5, jalon issue-vecue-producteurs)
// Le VRAI flux appelle conserverIssuesVecues juste après chaque écriture de conséquence (capacité, relation, réception, exécution).
const TABLES_CONSEQUENCES = ['variationsCapacite', 'variationsRelation', 'receptions', 'executionsOperations'];
const JUSQUA = (etiquette) => SCENARIO.slice(0, SCENARIO.findIndex((p) => p[1] === etiquette));
let mondeCout2 = null;
const vecuCout2 = () => (mondeCout2 ??= vivre([...JUSQUA('quatre'), ['msg', 'quatre', 2]]));
const parId = (lignes) => new Map(lignes.map((l) => [l.id, l]));
const avant1 = (v) => ({ ...v, horodatage: 'H' });

test('P1. « six » (vrai flux) : la conséquence écrite (variation du tour) laisse UNE ligne realisee, réel { valeurs: { arrivee: 1 } }, pour le contexte soi:tour retrouvé', async () => {
  const { w, etapes } = await vecuPartage();
  const six = tourDe(etapes, 'six');
  assert.equal(six.retrouvaille.statut, 'retrouvee');
  const variation = (await w.magasin.lireTout('variationsCapacite')).find((x) => x.cause.type === 'tour' && x.cause.id === six.idDesignation);
  assert.ok(variation, 'la conséquence de l\'acte est la variation du tour');
  const lignes = (await lireIssuesRetrouvailles(w.magasin)).filter((l) => l.idContexte === six.id);
  assert.equal(lignes.length, 1);
  assert.deepEqual(avant1(lignes[0]), { id: `issue-retrouvaille/${six.id}/${variation.id}`, idContexte: six.id, idDesignation: six.idDesignation, idExecution: variation.id, horodatage: 'H', observe: { statut: 'realisee', reel: ARRIVEE_1 } });
  // c'est exactement ce que la confrontation rendait au moment de la conséquence (et rend encore sur ce vécu)
  const [issue] = confronterRetrouvaille(six, await lireExecutionsVecues(w.magasin)).aujourdhui.issues;
  assert.deepEqual({ idExecution: issue.idExecution, ...lignes[0].observe }, issue);
});

test('P2. « quatre » à coût 2 (vrai flux) : réel 2→0 → UNE ligne autre, réel { valeurs: { arrivee: 0 } }', async () => {
  const { w, etapes } = await vecuCout2();
  const quatre = tourDe(etapes, 'quatre');
  assert.equal(quatre.retrouvaille.statut, 'retrouvee');
  assert.deepEqual(quatre.retrouvaille.relations[0].relation.attendu, ARRIVEE_1);
  const variation = (await w.magasin.lireTout('variationsCapacite')).find((x) => x.cause.type === 'tour' && x.cause.id === quatre.idDesignation);
  const lignes = (await lireIssuesRetrouvailles(w.magasin)).filter((l) => l.idContexte === quatre.id);
  assert.equal(lignes.length, 1);
  assert.deepEqual(avant1(lignes[0]), { id: `issue-retrouvaille/${quatre.id}/${variation.id}`, idContexte: quatre.id, idDesignation: quatre.idDesignation, idExecution: variation.id, horodatage: 'H', observe: { statut: 'autre', reel: { valeurs: { arrivee: 0 } } } });
});

test('P3. RIEN AVANT LA CONSÉQUENCE : chaque ligne est écrite JUSTE APRÈS l\'écriture du fait qu\'elle nomme (rien entre les deux que d\'autres lignes d\'issue vécue) ; toute ligne vient d\'un contexte retrouvee de son acte ; aucune pour aucune / non-effectuee', async () => {
  const { w } = await vecuPartage();
  const lignes = await lireIssuesRetrouvailles(w.magasin);
  assert.ok(lignes.length > 0, 'le vrai flux a écrit des issues vécues');
  const ecritures = JOURNAL.filter((j) => j.table === T);
  assert.deepEqual(new Set(ecritures.map((j) => j.id)), new Set(lignes.map((l) => l.id)), 'chaque ligne a été écrite une fois, par le flux');
  assert.equal(ecritures.length, lignes.length);
  for (const l of lignes) {
    const i = JOURNAL.findIndex((j) => j.table === T && j.id === l.id);
    const k = JOURNAL.findIndex((j) => TABLES_CONSEQUENCES.includes(j.table) && j.id === l.idExecution);
    assert.ok(k >= 0 && k < i, `${l.id} : le fait nommé est écrit AVANT la ligne`);
    assert.deepEqual(JOURNAL.slice(k + 1, i).filter((j) => j.table !== T), [], `${l.id} : la ligne suit immédiatement la conséquence`);
  }
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  const parContexte = new Map(contextes.map((c) => [c.id, c]));
  for (const l of lignes) {
    const c = parContexte.get(l.idContexte);
    assert.equal(c.retrouvaille.statut, 'retrouvee', l.id);
    assert.equal(c.idDesignation, l.idDesignation, l.id);
  }
  const autres = contextes.filter((c) => c.retrouvaille && c.retrouvaille.statut !== 'retrouvee');
  assert.ok(autres.some((c) => c.retrouvaille.statut === 'aucune'), 'des contextes « aucune » existent (ex. « deux »)');
  for (const c of autres) assert.equal(lignes.some((l) => l.idContexte === c.id), false, `${c.id} (${c.retrouvaille.statut}) : aucune ligne`);
});

// Ligne d'attente FORGÉE (même patron que tests/issue-retrouvaille.test.mjs, T5) : autre identité, autre acte, autre attendu.
function forger(gabarit, attendu) {
  const l = structuredClone(gabarit);
  l.id = 'attente-forgee-c1';
  l.references = { ...l.references, idDesignation: 'acte-forge-c1' };
  l.description.relation = { ...structuredClone(l.description.relation), attendu };
  delete l.reconnaissance;
  return l;
}
test('P3 bis. ABSTENTION (vrai flux) : une seconde relation 2→0 du même domaine rend « six » en abstention ; sa conséquence est écrite, AUCUNE ligne pour ce contexte', async () => {
  const w = monde({ marque: 'c1-abst' });
  for (const p of JUSQUA('six')) await w.etape(p);
  const g21 = (await w.magasin.lireTout('attentesProspectives')).find((l) => l.description && Object.hasOwn(l.description, 'relation') && vue(l.description.relation.domaine) === 'soi:tour(etat)' && l.description.relation.connu.valeurs.depart === 2 && JSON.stringify(l.description.relation.attendu) === JSON.stringify(ARRIVEE_1));
  assert.ok(g21, 'la relation 2→1 est formulée avant « six »');
  await w.magasin.ecrire('attentesProspectives', forger(g21, { valeurs: { arrivee: 0 } }));
  const nouveaux = await w.etape(['msg', 'six']);
  const six = nouveaux.find((c) => vue(c.structure) === 'soi:tour(etat)');
  assert.equal(six.retrouvaille.statut, 'abstention');
  assert.ok((await w.magasin.lireTout('variationsCapacite')).some((x) => x.cause.id === six.idDesignation), 'la conséquence a bien eu lieu');
  assert.equal((await lireIssuesRetrouvailles(w.magasin)).some((l) => l.idContexte === six.id), false);
});

test('P3 ter. HISTOIRE EXISTANTE : aucune ligne rétroactive — reprendre une histoire sans issues vécues n\'écrit rien ; seules les conséquences NOUVELLES en écrivent', async () => {
  const { w } = await vecuPartage();
  const base = await redemarrer(w.magasin, sansIssuesVecues);
  const faitsAnciens = new Set();
  for (const t of TABLES_CONSEQUENCES) for (const l of await base.lireTout(t)) faitsAnciens.add(l.id);
  const journal = [];
  const suite = monde({ journal, magasin: base, marque: 'c1-suite' });
  assert.deepEqual(await lireIssuesRetrouvailles(base), [], 'la reprise seule n\'écrit rien');
  for (const p of [['tick', 3], ['msg', 'huit'], ['msg', 'neuf']]) await suite.etape(p);
  const lignes = await lireIssuesRetrouvailles(base);
  assert.ok(lignes.length > 0, 'les conséquences nouvelles ont leurs lignes');
  for (const l of lignes) {
    assert.equal(faitsAnciens.has(l.idExecution), false, `${l.id} : aucune ligne pour un fait de l'histoire existante`);
    assert.ok(journal.some((j) => TABLES_CONSEQUENCES.includes(j.table) && j.id === l.idExecution), `${l.id} : fait écrit après la reprise`);
  }
});

test('P4. UNE SEULE LIGNE PAR COUPLE contexte/exécution, même si la conséquence est rappelée ; projection remplacée → relecture changée, ligne persistée identique ; export/import identique', async () => {
  const { w, etapes } = await vecuPartage();
  const lignes = await lireIssuesRetrouvailles(w.magasin);
  const couples = lignes.map((l) => `${l.idContexte}|${l.idExecution}`);
  assert.equal(new Set(couples).size, lignes.length, 'aucun couple répété');
  for (const l of lignes) assert.equal(l.id, `issue-retrouvaille/${l.idContexte}/${l.idExecution}`);
  // un nouvel appel au moment d'une autre conséquence (ou le même rappelé) ne double jamais une ligne
  const copie = await redemarrer(w.magasin);
  for (const l of lignes) assert.deepEqual(await conserverIssuesVecues(copie, { idDesignation: l.idDesignation, idExecution: l.idExecution }), []);
  assert.deepEqual(parId(await lireIssuesRetrouvailles(copie)), parId(lignes));
  // projection remplacée (comme le ferait un code de projection changé) : la relecture change, la ligne persistée non
  const six = tourDe(etapes, 'six');
  const figee = structuredClone(lignes.find((l) => l.idContexte === six.id));
  const v = await lireExecutionsVecues(copie);
  assert.deepEqual(confronterRetrouvaille(six, v).aujourdhui.issues.map(({ statut, reel }) => ({ statut, reel })), [{ statut: 'realisee', reel: ARRIVEE_1 }]);
  const changee = confronterRetrouvaille(six, { ...v, executions: v.executions.filter((e) => !/^variation-/.test(e.id)) });
  assert.deepEqual(changee.aujourdhui, { issues: [] }, 'la relecture dépend du vécu projeté actuel');
  assert.deepEqual((await lireIssuesRetrouvailles(copie)).find((l) => l.id === figee.id), figee, 'la ligne persistée ne dépend pas de la relecture');
  // export / import
  const memoire = creerMemoire(creerMagasinMemoire());
  const tablesMemoire = Object.keys(await memoire.exporterDonnees());
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage: copie, idNaissance: 'id', versionAppli: '0.66.5', maintenant: new Date('2026-10-25T09:00:00Z') });
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire });
  assert.equal(lue.ok, true, lue.erreur);
  const restaure = magasinMemoireVive();
  await restaure.remplacerTout(lue.donnees.langage);
  assert.deepEqual(await lireIssuesRetrouvailles(restaure), await lireIssuesRetrouvailles(copie));
  assert.deepEqual(parId(await lireIssuesRetrouvailles(restaure)), parId(lignes));
});

test('P5. L\'APPEL NE CHANGE NI LE RENDU NI LA CONSÉQUENCE : écriture des issues vécues en panne → le flux suit, la conséquence est écrite, aucune ligne', async () => {
  const magasin = magasinMemoireVive();
  const atomique = magasin.ecrireAtomique.bind(magasin);
  magasin.ecrireAtomique = async (ops) => { if (ops.some((o) => o.table === T)) throw new Error('quota'); return atomique(ops); };
  const w = monde({ magasin, marque: 'c1-panne' });
  const etapes = [];
  for (const p of JUSQUA('sept')) etapes.push({ etiquette: p[1], contextes: await w.etape(p) });
  const six = tourDe(etapes, 'six');
  assert.equal(six.retrouvaille.statut, 'retrouvee');
  assert.ok((await magasin.lireTout('variationsCapacite')).some((x) => x.cause.id === six.idDesignation), 'la conséquence est écrite malgré la panne');
  assert.equal((await lireCapacite(magasin)).valeur, 1, 'même trajectoire de capacité que sans panne');
  assert.deepEqual(await magasin.lireTout(T), []);
});

test('P6. STATIQUE : les cinq points d\'écriture appellent conserverIssuesVecues sur la ligne qui SUIT l\'écriture, avec l\'acte et l\'id du fait écrit', () => {
  const sites = [
    ['capacite.js', 'enregistrerVariationCapacite', 'variation', 2],
    ['relation.js', 'enregistrerVariationRelation', 'variation', 2],
    ['environnement-conversation.js', 'enregistrerReception', 'reception', 1],
    ['execution-sollicitee.js', 'enregistrerExecutionOperation', 'execution', 1],
  ];
  for (const [f, ecrivain, nom, n] of sites) {
    const lignes = sansCommentaires(lu('app', 'langage', f)).split('\n');
    const rangs = lignes.map((l, i) => (l.includes(`const ${nom} = await ${ecrivain}(`) ? i : -1)).filter((i) => i >= 0);
    assert.equal(rangs.length, n, f);
    for (const i of rangs) assert.match(lignes[i + 1].trim(), new RegExp(`^await conserverIssuesVecues\\((dependances\\.)?magasin, \\{ idDesignation: .+, idExecution: ${nom}\\.id \\}\\);$`), `${f} : ligne ${i + 2}`);
    assert.equal((lignes.join('\n').match(/conserverIssuesVecues\(/g) || []).length, n, f);
    assert.ok(lignes.includes('import { conserverIssuesVecues } from \'./issues-vecues.js\';'), f);
  }
});

// ================================================================================================================ Diagnostic (v0.66.5, jalon issue-vecue-diagnostic)
// Le pont Diagnostic de main.js lit AUSSI les issues vécues persistées (lireIssuesRetrouvailles), à côté de la relecture d'aujourd'hui ; l'écran
// montre, pour chaque contexte retrouvé, la ligne PERSISTÉE à T3 ENTRE la retrouvaille T2 et « RELUE AUJOURD'HUI ». Rien n'est corrigé ni écrit.
const { relireRetrouvailles, attentesEcritesParContexte } = await import('../app/langage/retrouvailles-persistees.js');
const { confrontationsDesRetrouvailles } = await import('../app/langage/issue-retrouvaille.js');
const { texteDiagnostic } = await import('../app/conversation/texte-diagnostic.js');
// Pont Diagnostic COMPLET (même code que main.js).
async function pontComplet(magasin) {
  const [contextes, lignes] = await Promise.all([magasin.lireTout('contextesProspectifs'), magasin.lireTout('attentesProspectives')]);
  let issues;
  try { issues = confrontationsDesRetrouvailles(contextes, await lireExecutionsVecues(magasin)); } catch (err) { issues = { erreur: err && err.message ? err.message : String(err) }; }
  let vecues; try { vecues = await lireIssuesRetrouvailles(magasin); } catch (err) { vecues = { erreur: err && err.message ? err.message : String(err) }; }
  return { relues: relireRetrouvailles(contextes), attentes: attentesEcritesParContexte(lignes), issues, issuesVecues: vecues };
}
// DOM factice : même forme que tests/issue-retrouvaille.test.mjs.
class Faux {
  get parentNode() { return this.parent; }
  get textContent() { return this._texte; }
  set textContent(v) { this._texte = String(v); this.children = []; }
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.attrs = {}; this.open = false; this.type = ''; }
  get tagName() { return this.tag.toUpperCase(); }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c, ref) { if (c.parent) c.remove(); c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  focus() {}
  scrollIntoView() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const basculer = async (e, ouvert) => { e.open = ouvert; await Promise.all((e.listeners.toggle || []).map((f) => f())); await new Promise((r) => setTimeout(r, 0)); };
async function texteDuDiagnostic(retrouvailles) {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  globalThis.window = globalThis;
  const { monterConversation } = await import('../app/conversation/ecran.js');
  const page = new Faux('main'); const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  page.append(liste, formulaire);
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const capacite = { lire: async () => ({ valeur: 2, plafond: 3, derniere: null, besoins: [] }), repos: async () => ({}), retrouvailles };
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: async () => ({ texte: 'ok' }), capacite });
  await conv.recharger();
  const zone = page.children.find((c) => c._cls.has('diagnostic'));
  await basculer(zone, true);
  return texteDiagnostic(zone);
}
const court = (id) => { const x = id.match(/^([a-z-]+?)-\d{10,}-(\d+-\d+)$/); return x ? `${x[1]}…${x[2]}` : id; };
const blocDe = (texte, c) => { const l = texte.split('\n'); const i = l.findIndex((x) => x.includes(`contexte ${court(c.id)} ·`)); assert.ok(i >= 0, c.id); const j = l.findIndex((x, k) => k > i && x.trim().startsWith('contexte ')); return l.slice(i, j < 0 ? undefined : j).map((x) => x.trim()); };
const T2 = 'RELATION RETROUVÉE À T2 — PERSISTÉE';
const T3 = 'ISSUE VÉCUE À T3 — PERSISTÉE';
const RELUE = 'ISSUE DE CETTE RETROUVAILLE — RELUE AUJOURD\'HUI (faits persistés, code actuel ; rien n\'est écrit)';

test('D1. DIAGNOSTIC (vrai flux) : pour chaque contexte retrouvé, la ligne persistée à T3 s\'affiche ENTRE la retrouvaille T2 et « RELUE AUJOURD\'HUI » ; ordre T2 / T3 persistée / relue ; aucun écart quand elles concordent ; le pont n\'écrit rien', async () => {
  const { w, etapes } = await vecuPartage();
  const lignes = await lireIssuesRetrouvailles(w.magasin);
  const espion = espionner(w.magasin);
  const pont = await pontComplet(espion.magasin);
  assert.deepEqual(espion.journal.filter((j) => j[0] !== 'lire'), [], 'le pont ne fait que lire');
  assert.deepEqual(parId(pont.issuesVecues), parId(lignes), 'les lignes persistées, telles quelles');
  const texte = await texteDuDiagnostic(async () => pont);
  const six = tourDe(etapes, 'six');
  const [ligneSix] = lignes.filter((l) => l.idContexte === six.id);
  const bloc = blocDe(texte, six);
  const iT2 = bloc.indexOf(T2); const iT3 = bloc.indexOf(T3); const iRelue = bloc.indexOf(RELUE);
  assert.ok(iT2 > 0 && iT3 > iT2 && iRelue > iT3, `ordre T2 / T3 persistée / relue : ${bloc.join(' | ')}`);
  assert.ok(iT3 > bloc.findIndex((x) => x.startsWith('attentes de ce contexte')), 'après le groupe T2 et ses attentes');
  assert.equal(bloc[iT3 + 1], `conséquence ${court(ligneSix.idExecution)} : réalisée — réel { valeurs: { arrivee: 1 } } — persistée le ${ligneSix.horodatage.slice(0, 10)} ${ligneSix.horodatage.slice(11, 23)}, relue telle quelle`);
  assert.equal(bloc[iRelue + 1], `conséquence ${court(ligneSix.idExecution)} : réalisée — réel { valeurs: { arrivee: 1 } }`);
  assert.equal(bloc.some((x) => x.startsWith('ÉCART')), false, 'persistée et relue concordent : aucun écart');
  // tout contexte qui porte une ligne la montre, entre T2 et la relecture
  for (const l of lignes) {
    const b = blocDe(texte, { id: l.idContexte });
    assert.ok(b.indexOf(T2) < b.indexOf(T3) && b.indexOf(T3) < b.indexOf(RELUE), l.id);
    assert.ok(b.some((x) => x.startsWith(`conséquence ${court(l.idExecution)} : `) && x.endsWith(', relue telle quelle')), l.id);
  }
  // « deux » (aucune relation retrouvée) : ni T3, ni relecture
  const deux = blocDe(texte, tourDe(etapes, 'deux'));
  assert.equal(deux.includes(T3), false);
  assert.doesNotMatch(texte, /score|compte|fréquen|confiance|préf[ée]r|décision|succès|échec/i);
  assert.deepEqual(parId(await lireIssuesRetrouvailles(w.magasin)), parId(lignes), 'table inchangée');
});

test('D2. ÉCART persistée / relue signalé, rien n\'est corrigé ni écrit ; contexte sans ligne → « aucune issue vécue persistée » ; pont sans issuesVecues : rien ; illisible : ligne d\'erreur', async () => {
  const { w, etapes } = await vecuPartage();
  const reel = await pontComplet(w.magasin);
  const avant = structuredClone(reel);
  const six = tourDe(etapes, 'six');
  const ligneSix = reel.issuesVecues.find((l) => l.idContexte === six.id);
  // écart : la ligne persistée dit « autre 0 », la relecture d'aujourd'hui dit « réalisée 1 »
  const autre = { ...reel, issuesVecues: reel.issuesVecues.map((l) => (l.id === ligneSix.id ? { ...l, observe: { statut: 'autre', reel: { valeurs: { arrivee: 0 } } } } : l)) };
  let bloc = blocDe(await texteDuDiagnostic(async () => autre), six);
  let k = bloc.indexOf(T3);
  assert.ok(k > bloc.indexOf(T2) && k < bloc.indexOf(RELUE));
  assert.match(bloc[k + 1], /^conséquence variation-capacite…\d+-\d+ : autre — réel \{ valeurs: \{ arrivee: 0 \} \} — persistée le /);
  assert.equal(bloc[k + 2], 'ÉCART — persistée à T3 : autre — réel { valeurs: { arrivee: 0 } } ; relue aujourd\'hui : réalisée — réel { valeurs: { arrivee: 1 } } ; rien n\'est corrigé ni écrit');
  assert.equal(bloc[bloc.indexOf(RELUE) + 1], `conséquence ${court(ligneSix.idExecution)} : réalisée — réel { valeurs: { arrivee: 1 } }`, 'la relecture reste montrée telle quelle');
  // écart sur le réel seul (même statut)
  const reelDifferent = { ...reel, issuesVecues: reel.issuesVecues.map((l) => (l.id === ligneSix.id ? { ...l, observe: { statut: 'realisee', reel: { valeurs: { arrivee: 2 } } } } : l)) };
  bloc = blocDe(await texteDuDiagnostic(async () => reelDifferent), six);
  assert.ok(bloc.includes('ÉCART — persistée à T3 : réalisée — réel { valeurs: { arrivee: 2 } } ; relue aujourd\'hui : réalisée — réel { valeurs: { arrivee: 1 } } ; rien n\'est corrigé ni écrit'));
  // la relecture d'aujourd'hui ne contient plus cette conséquence
  const sansRelue = { ...reel, issues: reel.issues.map((i) => (i.idContexte === six.id ? { ...i, aujourdhui: { issues: [] } } : i)) };
  bloc = blocDe(await texteDuDiagnostic(async () => sansRelue), six);
  assert.ok(bloc.includes('ÉCART — cette conséquence n\'apparaît pas dans la relecture d\'aujourd\'hui ; rien n\'est corrigé ni écrit'));
  // contexte retrouvé sans ligne persistée
  const sansLigne = { ...reel, issuesVecues: reel.issuesVecues.filter((l) => l.idContexte !== six.id) };
  bloc = blocDe(await texteDuDiagnostic(async () => sansLigne), six);
  k = bloc.indexOf(T3);
  assert.ok(k > bloc.indexOf(T2) && k < bloc.indexOf(RELUE));
  assert.equal(bloc[k + 1], 'aucune issue vécue persistée');
  assert.equal(bloc.some((x) => x.startsWith('ÉCART')), false);
  // pont sans issuesVecues (forme antérieure) : aucune ligne T3, le reste inchangé
  const { issuesVecues, ...ancien } = reel;
  assert.ok(Array.isArray(issuesVecues));
  const texteAncien = await texteDuDiagnostic(async () => ancien);
  assert.equal(texteAncien.includes(T3), false);
  assert.ok(blocDe(texteAncien, six).includes(RELUE));
  // table illisible : une ligne d'erreur, groupes et relecture intacts
  bloc = blocDe(await texteDuDiagnostic(async () => ({ ...reel, issuesVecues: { erreur: 'table cassée' } })), six);
  k = bloc.indexOf(T3);
  assert.ok(k > bloc.indexOf(T2) && k < bloc.indexOf(RELUE));
  assert.equal(bloc[k + 1], 'issues vécues persistées non lisibles : table cassée');
  // rien n'a été corrigé : les données reçues par l'écran sont intactes, la table aussi
  assert.deepEqual(reel, avant);
  assert.deepEqual(parId(await lireIssuesRetrouvailles(w.magasin)), parId(avant.issuesVecues));
});

test('D3. STATIQUE : main.js lit lireIssuesRetrouvailles dans le seul pont Diagnostic, à côté de confrontationsDesRetrouvailles ; l\'écran n\'importe pas la table et n\'en tire aucun nombre', () => {
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.match(main, /^import \{ lireIssuesRetrouvailles \} from '\.\/langage\/connaissances\.js';$/m);
  assert.equal((main.match(/lireIssuesRetrouvailles\(/g) || []).length, 1);
  const k = main.indexOf('retrouvailles: async () => {'); const pont = main.slice(k, main.indexOf('\n    },', k));
  const iConf = pont.indexOf('confrontationsDesRetrouvailles(contextes'); const iVec = pont.indexOf('lireIssuesRetrouvailles(e.magasin)');
  assert.ok(iConf > 0 && iVec > iConf, 'lue juste après la relecture d\'aujourd\'hui, dans le même pont');
  assert.match(pont, /issues, issuesVecues: vecues \};/);
  assert.doesNotMatch(main, /enregistrerIssueRetrouvaille|conserverIssuesVecues/);
  const ecran = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  assert.doesNotMatch(ecran, /connaissances\.js|lireIssuesRetrouvailles|issuesRetrouvailles|lireTout/);
  const i = ecran.indexOf('const ENTETE_ISSUE_VECUE'); const bloc = ecran.slice(i, ecran.indexOf('function creerSectionRetrouvailles(', i));
  assert.ok(i > 0);
  assert.doesNotMatch(bloc, /score|compte|cumul|frequen|confiance|preferen|decision|\.sort\(|reduce\(|seuil|ecrire|enregistrer|horodatage\s*[<>=!]/i);
});

// ================================================================================================================ gardes
test('G1. module : un seul export, imports exacts ; aucun score, compte, fréquence, confiance, préférence ni décision ; socle inchangé', () => {
  assert.deepEqual(Object.keys(MODULE), ['conserverIssuesVecues']);
  const code = sansCommentaires(lu('app', 'langage', 'issues-vecues.js'));
  assert.deepEqual([...code.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]), ['./connaissances.js', './executions-vecues.js', './issue-retrouvaille.js']);
  assert.doesNotMatch(code, /score|compte|cumul|frequen|confiance|preferen|decision|decide|choisi|Math\.|random|\.sort\(|reduce\(|seuil|priorite|vote|majorit/i);
  assert.doesNotMatch(code, /ecrire\(|ecrireAtomique|remplacerTout|supprimer|vider/, 'aucune écriture hors de l\'écrivain');
  assert.deepEqual([...code.matchAll(/lireTout\('(\w+)'\)/g)].map((m) => m[1]), ['contextesProspectifs']);
  assert.equal(VERSION_BASE, 30); assert.equal(SCHEMA_SAUVEGARDE, 20); assert.equal(TABLES.length, 36); assert.equal(TABLES.at(-1), T);
});
