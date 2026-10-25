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
