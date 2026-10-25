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

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const T = 'issuesRetrouvailles';
const ARRIVEE_1 = { valeurs: { arrivee: 1 } };

// ---------------------------------------------------------------------------------------------------------------- vécu réel (harnais recopié)
function monde() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-c1-${++n}`;
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
async function vivre(plan) {
  const w = monde(); const etapes = [];
  for (const p of plan) etapes.push({ etiquette: p[1], contextes: await w.etape(p) });
  return { w, etapes };
}
let partage = null;
const vecuPartage = () => (partage ??= vivre(SCENARIO)); // lecture seule : chaque test travaille sur une copie (redemarrer)
const tourDe = (etapes, etiquette) => etapes.find((e) => e.etiquette === etiquette).contextes.find((c) => vue(c.structure) === 'soi:tour(etat)');
async function redemarrer(magasin) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await magasin.lireTout(t)));
  const neuf = magasinMemoireVive();
  await neuf.remplacerTout(donnees);
  return neuf;
}
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
  const copie = await redemarrer(w.magasin);
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
  const copie = await redemarrer(w.magasin);
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
  const copie = await redemarrer(w.magasin);
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
