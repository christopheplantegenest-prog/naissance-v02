// v0.64.29 — « RECONNAÎTRE UNE RELATION DÉJÀ FORMULÉE » (GO ChatGPT « GO DÉVELOPPEMENT v0.64.29 », 16/10/2026).
// Au moment où une attente conditionnée C est écrite, enregistrerAttenteProspective relève, parmi les attentes déjà persistées d'AUTRES actes,
// celles dont la relation est exactement la même, et conserve leurs identités dans C (groupe reconnaissance), avec pour chacune « mêmes
// épisodes témoins » ou « épisodes témoins différents ». Tests T1–T24 de la fiche (+ T25–T27 : forme lue, attente .74, gardes statiques).
// Le vécu est produit par le VRAI flux (même harnais que tests/attentes-conditionnees-persistees.test.mjs) ; les cas qui n'apparaissent pas
// naturellement (même tour, lignes anciennes, lignes illisibles, valeurs exotiques) passent par le VRAI écrivain avec des attentes construites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { memesRelations, formulationsAnterieures } from '../app/langage/relations-formulees.js';
import * as MODULE from '../app/langage/relations-formulees.js';
import { rolesDeLAttente } from '../app/langage/roles-attente.js';
import { relireAttentesConditionnees } from '../app/langage/attentes-conditionnees-persistees.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerAttenteProspective, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { attentePlate } from './projection-attente.mjs';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(js|html)$/.test(p) ? [p] : []; });
const rel = (f) => f.slice(RACINE.length + 1);
const S2 = 'symbolesDeChaine(chaine)>environnement:conversation(emis)';
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const CANON = [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui']];
const INTERDITS = /succ[eè]s|[ée]chec|r[ée]ussite|meilleur|score|habitude|r[eè]gle|r[ée]gularit|strat[ée]gi|pr[ée]f[ée]ren|cat[ée]gori|abstraction|fr[ée]quen|compteur|nombre de fois|d[ée]j[aà] rencontr|preuve (nouvelle|ind[ée]pendante|plus forte)|m[eê]me rapport|objet relationnel/i;

// ---------------------------------------------------------------------------------------------------------------- magasin instrumenté
// aveugle : la lecture de attentesProspectives rend [] (aucun passé à reconnaître) ; journal : chaque lecture et écriture, dans l'ordre réel.
function instrumenter(magasin, { aveugle, journal }) {
  const lireTout = magasin.lireTout.bind(magasin);
  const ecrire = magasin.ecrire.bind(magasin);
  magasin.lireBrut = lireTout; // lecture non aveuglée, pour comparer les tables à la fin d'un scénario
  magasin.lireTout = async (table) => {
    const lignes = aveugle && table === 'attentesProspectives' ? [] : await lireTout(table);
    if (journal) journal.push({ op: 'lire', table, ids: lignes.map((l) => l.id) });
    return lignes;
  };
  magasin.ecrire = async (table, objet) => {
    if (journal) journal.push({ op: 'ecrire', table, id: objet.id, objet: structuredClone(objet) });
    return ecrire(table, objet);
  };
  return magasin;
}

// ---------------------------------------------------------------------------------------------------------------- vécu réel
function monde({ aveugle = false, journal = null } = {}) {
  const magasin = instrumenter(magasinMemoireVive(), { aveugle, journal }); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
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
async function histoire(paires, present) {
  const w = monde();
  for (const [x, y] of paires) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tick(2); }
  const E = await w.emettre(present);
  return { w, E };
}

// Le vécu complet sondé (16/10/2026) : histoire CANON, émission « salut », réponse « oui », un Repos, nouvelle émission « salut ».
async function vecuComplet(options) {
  const w = monde(options);
  for (const [x, y] of CANON) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tick(2); }
  const E1 = await w.emettre('salut'); await w.tour('oui', E1.id); await w.tick(1);
  const E2 = await w.emettre('salut');
  return { w, E1, E2 };
}
let partage = null;
const JOURNAL = [];
const vecuPartage = () => (partage ??= vecuComplet({ journal: JOURNAL })); // lecture seule : jamais modifié par les tests qui le partagent (journal complet de ses lectures et écritures)
const conditionnees = async (magasin) => (await magasin.lireTout('attentesProspectives')).filter((l) => l.description && Object.hasOwn(l.description, 'relation'));
const ids = (r) => r.formulationsAnterieures.map((a) => a.idAttente);

async function pontAvant(magasin) {
  const [lignes, designations, emissions, observations] = await Promise.all([magasin.lireTout('attentesProspectives'), magasin.lireTout('designations'), magasin.lireTout('emissions'), magasin.lireTout('observationsPossibilites')]);
  return relireAttentesConditionnees(lignes, { designations, emissions, observations });
}
async function pontAujourdhui(magasin) {
  const [lignes, contextes] = await Promise.all([magasin.lireTout('attentesProspectives'), magasin.lireTout('contextesProspectifs')]);
  return relireIssuesAujourdhui(lignes, contextes, await lireExecutionsVecues(magasin));
}
async function redemarrer(w) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t)));
  const magasin = magasinMemoireVive();
  await magasin.remplacerTout(donnees);
  return magasin;
}


// ---------------------------------------------------------------------------------------------------------------- attentes construites
// Une attente conditionnée VALIDE pour le vrai écrivain : acte, contexte et relation au choix ; épisodes témoins (unitesIssues) au choix.
const REL = (operation, depart, arrivee, entree = 'etat') => ({ domaine: [{ operation, entrees: [entree] }], connu: { valeurs: { depart } }, attendu: { valeurs: { arrivee } } });
function entree({ acte, idObservation = 'observation-1', contexte = `contexte-${acte}`, relation, unites = [['execution-u1']] }) {
  return {
    designation: { id: acte, idObservation },
    contexte: { id: contexte, idDesignation: acte },
    attente: {
      description: { structure: [{ operation: 'f', entrees: ['etat'] }], chemin: ['valeurs', 'arrivee'], constat: { type: 'nombre', valeur: 1 }, relation },
      preuve: { temoinsContexte: [['execution-t1']], unitesIssues: unites, fondation: [{ couverture: [['execution-u1']], constats: [{ chemin: ['a'], type: 'nombre', valeur: 1 }, { chemin: ['b'], type: 'nombre', valeur: 1 }], conditions: [{ chemin: ['valeurs', 'depart'], type: 'nombre', valeur: 2 }] }] },
      references: { idContexte: contexte, idDesignation: acte },
    },
  };
}
const ecrireC = (magasin, options) => enregistrerAttenteProspective(magasin, entree(options));
// Ligne plate historique (.63.74–.64.6) : la forme structurée projetée ; sansRelation : .63.74–.64.4.
const plate = (ligne, { sansRelation = false } = {}) => { const { reconnaissance, ...l } = ligne; const p = attentePlate(l); if (sansRelation) { delete p.relation; delete p.fondation; } return p; };

// ================================================================================================================ T1–T2 vrai flux
test('T1. PREMIÈRE FORMULATION : la première attente conditionnée d\'une relation porte reconnaissance { formulationsAnterieures: [], nonComparees: [] } (groupe présent, listes vides)', async () => {
  const { w } = await vecuPartage();
  const lignes = await conditionnees(w.magasin);
  const s2 = lignes.filter((l) => vue(l.description.relation.domaine) === S2);
  assert.ok(s2.length >= 4);
  assert.deepEqual(s2[0].reconnaissance, { formulationsAnterieures: [], nonComparees: [] });
  for (const l of lignes) {
    assert.ok(Object.hasOwn(l, 'reconnaissance'), 'toute attente conditionnée écrite par v0.64.29 porte le groupe');
    const premiere = !lignes.slice(0, lignes.indexOf(l)).some((a) => a.references.idDesignation !== l.references.idDesignation && memesRelations(a.description.relation, l.description.relation));
    if (premiere) assert.deepEqual(l.reconnaissance.formulationsAnterieures, [], l.id);
  }
});

test('T2. REFORMULATION PAR UN AUTRE ACTE : la même relation, écrite par un acte différent, reconnaît TOUTES les formulations antérieures (ordre de la table) ; rien d\'autre', async () => {
  const { w } = await vecuPartage();
  const lignes = await conditionnees(w.magasin);
  const s2 = lignes.filter((l) => vue(l.description.relation.domaine) === S2);
  for (const [i, l] of s2.entries()) assert.deepEqual(ids(l.reconnaissance), s2.slice(0, i).map((a) => a.id), l.id);
  assert.ok(new Set(s2.map((l) => l.references.idDesignation)).size === s2.length, 'chacune vient d\'un acte distinct');
  // et, pour toutes les lignes : exactement les antérieures d'autres actes à relation égale
  for (const [i, l] of lignes.entries()) {
    const attendu = lignes.slice(0, i).filter((a) => a.references.idDesignation !== l.references.idDesignation && memesRelations(a.description.relation, l.description.relation)).map((a) => a.id);
    assert.deepEqual(ids(l.reconnaissance), attendu, l.id);
  }
  assert.ok(lignes.some((l) => vue(l.description.relation.domaine) === 'soi:tour(etat)' && l.reconnaissance.formulationsAnterieures.length > 0), 'soi:tour 2→1 reconnu d\'un tour à l\'autre');
});

// ================================================================================================================ T3–T4 identité de l'acte
test('T3. MÊME ACTE : deux attentes du même acte (même references.idDesignation) ne se reconnaissent jamais ; synthétique (fonction pure) et vrai écrivain', async () => {
  const R = REL('soi:tour', 2, 1);
  const A = { id: 'attente-a', ...entree({ acte: 'acte-1', relation: R }).attente };
  const B = { id: 'attente-b', ...entree({ acte: 'acte-1', relation: R }).attente };
  assert.deepEqual(formulationsAnterieures(entree({ acte: 'acte-1', relation: R }).attente, [A, B]), { formulationsAnterieures: [], nonComparees: [] });
  // vrai écrivain : la seconde écriture du même acte ne reconnaît pas la première
  const magasin = magasinMemoireVive();
  const c1 = await ecrireC(magasin, { acte: 'acte-1', relation: R });
  const c2 = await ecrireC(magasin, { acte: 'acte-1', contexte: 'contexte-acte-1', relation: R });
  assert.deepEqual(c1.reconnaissance, { formulationsAnterieures: [], nonComparees: [] });
  assert.deepEqual(c2.reconnaissance, { formulationsAnterieures: [], nonComparees: [] });
  // vrai flux : rejouer l'écriture de l'attente S2 de l'émission présente (avant son issue) ne la reconnaît pas
  const partageE = await vecuPartage(); const E2 = partageE.E2;
  const w = { magasin: await redemarrer(partageE.w) }; // copie : le vécu partagé n'est pas modifié
  const [C] = (await conditionnees(w.magasin)).filter((l) => l.references.idDesignation === E2.id && vue(l.description.relation.domaine) === S2);
  const [contexte] = (await w.magasin.lireTout('contextesProspectifs')).filter((c) => c.id === C.references.idContexte);
  const rejouee = await enregistrerAttenteProspective(w.magasin, { designation: { id: E2.id, idObservation: E2.idObservation }, contexte, attente: { description: C.description, preuve: C.preuve, references: C.references } });
  assert.equal(ids(rejouee.reconnaissance).includes(C.id), false, 'jamais une attente du même acte');
  assert.deepEqual(ids(rejouee.reconnaissance), ids(C.reconnaissance), 'les autres actes restent reconnus');
  // l'égalité porte sur la chaîne ENTIÈRE : un préfixe ou une chaîne plus longue est un autre acte
  const m2 = magasinMemoireVive();
  const a = await ecrireC(m2, { acte: 'acte-1', relation: R });
  const b = await ecrireC(m2, { acte: 'acte-10', relation: R });
  const c = await ecrireC(m2, { acte: 'acte', relation: R });
  assert.deepEqual(ids(b.reconnaissance), [a.id]); assert.deepEqual(ids(c.reconnaissance), [a.id, b.id]);
});

test('T4. DEUX ACTES DU MÊME TOUR (même idObservation, idDesignation différents) restent distincts : le second reconnaît le premier, chacun garde sa ligne', async () => {
  const R = REL('soi:tour', 3, 2);
  const magasin = magasinMemoireVive();
  const a = await ecrireC(magasin, { acte: 'emission-1', idObservation: 'observation-7', relation: R });
  const b = await ecrireC(magasin, { acte: 'designation-2', idObservation: 'observation-7', relation: R });
  assert.deepEqual(a.reconnaissance.formulationsAnterieures, []);
  assert.deepEqual(b.reconnaissance.formulationsAnterieures, [{ idAttente: a.id, temoins: 'identiques' }]);
  const lignes = await magasin.lireTout('attentesProspectives');
  assert.deepEqual(lignes.map((l) => l.id), [a.id, b.id], 'deux lignes, aucune fusion');
  assert.deepEqual(lignes.map((l) => l.idObservation), ['observation-7', 'observation-7']);
});

// ================================================================================================================ T5–T6 témoins
test('T5–T6. ÉPISODES TÉMOINS : mêmes unitesIssues → « identiques » ; un épisode de plus, de moins ou autre → « differents » ; rien d\'autre n\'est dit (vrai flux et écrivain)', async () => {
  const { w } = await vecuPartage();
  const s2 = (await conditionnees(w.magasin)).filter((l) => vue(l.description.relation.domaine) === S2);
  const parId = new Map(s2.map((l) => [l.id, l]));
  let identiques = 0; let differents = 0;
  for (const l of s2) for (const f of l.reconnaissance.formulationsAnterieures) {
    const a = parId.get(f.idAttente);
    const memes = JSON.stringify([...a.preuve.unitesIssues].map(String).sort()) === JSON.stringify([...l.preuve.unitesIssues].map(String).sort());
    assert.equal(f.temoins, memes ? 'identiques' : 'differents');
    if (memes) identiques += 1; else differents += 1;
  }
  assert.ok(identiques > 0 && differents > 0, 'les deux cas se produisent sur le vrai flux');
  const R = REL('soi:repos', 1, 2);
  for (const [unites, attendu] of [[[['execution-u1']], 'identiques'], [[['execution-u1'], ['execution-u2']], 'differents'], [[['execution-u9']], 'differents']]) {
    const magasin = magasinMemoireVive();
    const a = await ecrireC(magasin, { acte: 'acte-a', relation: R, unites: [['execution-u1']] });
    const c = await ecrireC(magasin, { acte: 'acte-c', relation: R, unites });
    assert.deepEqual(c.reconnaissance.formulationsAnterieures, [{ idAttente: a.id, temoins: attendu }]);
  }
  // l'ordre des épisodes dans la couverture n'a pas de sens
  const magasin = magasinMemoireVive();
  const a = await ecrireC(magasin, { acte: 'acte-a', relation: R, unites: [['execution-u1'], ['execution-u2']] });
  const c = await ecrireC(magasin, { acte: 'acte-c', relation: R, unites: [['execution-u2'], ['execution-u1']] });
  assert.deepEqual(c.reconnaissance.formulationsAnterieures, [{ idAttente: a.id, temoins: 'identiques' }]);
});

// ================================================================================================================ T7–T12 égalité exacte
test('T7–T12. ÉGALITÉ EXACTE DE LA RELATION ENTIÈRE : domaine différent ; 2→1 / 1→0 ; 3→2 / 2→1 ; arrivee / relationValeur ; 0 / −0 ; 1 / "1" — aucun raccord ; ordre des clés indifférent ; ordre du domaine signifiant', async () => {
  const D = (operation, entrees = ['etat']) => [{ operation, entrees }];
  const cas = [
    ['T7 domaine', REL('soi:repos', 0, 1), REL('soi:temps', 0, 1)],
    ['T7 entrée du domaine', REL('soi:tour', 2, 1, 'etat'), REL('soi:tour', 2, 1, 'autre')],
    ['T8 2→1 / 1→0', REL('soi:tour', 2, 1), REL('soi:tour', 1, 0)],
    ['T9 3→2 / 2→1', REL('soi:tour', 3, 2), REL('soi:tour', 2, 1)],
    ['T10 arrivee / relationValeur', { domaine: D('soi:temps'), connu: { valeurs: { depart: 3 } }, attendu: { valeurs: { arrivee: 'egale' } } }, { domaine: D('soi:temps'), connu: { valeurs: { depart: 3 } }, attendu: { relationValeur: 'egale' } }],
    ['T11 0 / −0', REL('soi:tour', 1, 0), REL('soi:tour', 1, -0)],
    ['T11 −0 au connu', REL('soi:tour', 0, 1), REL('soi:tour', -0, 1)],
    ['T12 1 / "1"', REL('soi:tour', 2, 1), REL('soi:tour', 2, '1')],
    ['ordre des étapes', { domaine: [...D('a'), ...D('b')], connu: { valeurs: { depart: 1 } }, attendu: { valeurs: { arrivee: 2 } } }, { domaine: [...D('b'), ...D('a')], connu: { valeurs: { depart: 1 } }, attendu: { valeurs: { arrivee: 2 } } }],
    ['ordre des entrées', REL('f', 1, 2, 'x'), { domaine: [{ operation: 'f', entrees: ['x', 'y'] }], connu: { valeurs: { depart: 1 } }, attendu: { valeurs: { arrivee: 2 } } }],
    ['chemin du connu', REL('soi:tour', 2, 1), { domaine: D('soi:tour'), connu: { valeurs: { arrivee: 2 } }, attendu: { valeurs: { arrivee: 1 } } }],
    ['condition en plus', REL('soi:tour', 2, 1), { domaine: D('soi:tour'), connu: { valeurs: { depart: 2, autre: 0 } }, attendu: { valeurs: { arrivee: 1 } } }],
    ['null / absent', { domaine: D('f'), connu: { valeurs: { depart: null } }, attendu: { valeurs: { arrivee: 1 } } }, { domaine: D('f'), connu: { valeurs: {} }, attendu: { valeurs: { arrivee: 1 } } }],
    ['objet vide / tableau vide', { domaine: D('f'), connu: { valeurs: {} }, attendu: { valeurs: { arrivee: 1 } } }, { domaine: D('f'), connu: { valeurs: [] }, attendu: { valeurs: { arrivee: 1 } } }],
  ];
  for (const [nom, r1, r2] of cas) {
    assert.equal(memesRelations(r1, r2), false, nom); assert.equal(memesRelations(r2, r1), false, nom);
    const magasin = magasinMemoireVive();
    await ecrireC(magasin, { acte: 'acte-a', relation: r1 });
    const c = await ecrireC(magasin, { acte: 'acte-c', relation: r2 });
    assert.deepEqual(c.reconnaissance, { formulationsAnterieures: [], nonComparees: [] }, nom);
  }
  // égalités vraies : copie, ordre des clés d'objet indifférent, 0 = 0, −0 = −0
  const r = { domaine: D('soi:tour'), connu: { valeurs: { depart: 2 } }, attendu: { valeurs: { arrivee: 1 } } };
  assert.equal(memesRelations(r, structuredClone(r)), true);
  assert.equal(memesRelations(r, { attendu: { valeurs: { arrivee: 1 } }, connu: { valeurs: { depart: 2 } }, domaine: D('soi:tour') }), true, 'ordre des clés sans signification');
  assert.equal(memesRelations(REL('f', -0, 1), REL('f', -0, 1)), true);
  assert.equal(memesRelations(REL('f', 0, 1), REL('f', 0, 1)), true);
  // vrai flux : soi:repos 0→1 et soi:temps 0→1, 2→1 et 1→0 coexistent sans aucun raccord
  const { w } = await vecuPartage();
  const lignes = await conditionnees(w.magasin);
  const parId = new Map(lignes.map((l) => [l.id, l]));
  for (const l of lignes) for (const id of ids(l.reconnaissance)) {
    const a = parId.get(id);
    assert.equal(vue(a.description.relation.domaine), vue(l.description.relation.domaine));
    assert.equal(JSON.stringify(a.description.relation), JSON.stringify(l.description.relation));
  }
  const court = (l) => `${vue(l.description.relation.domaine)} ${JSON.stringify(l.description.relation.connu)} ${JSON.stringify(l.description.relation.attendu)}`;
  assert.ok(lignes.some((l) => court(l) === 'soi:tour(etat) {"valeurs":{"depart":1}} {"valeurs":{"arrivee":0}}' && l.reconnaissance.formulationsAnterieures.length === 0), '1→0 : première formulation malgré les 2→1 antérieurs');
  assert.ok(lignes.some((l) => court(l) === 'soi:temps(etat) {"valeurs":{"depart":0}} {"valeurs":{"arrivee":1}}') && lignes.some((l) => court(l) === 'soi:repos(etat) {"valeurs":{"depart":0}} {"valeurs":{"arrivee":1}}'));
});

// ================================================================================================================ T13–T16 lignes anciennes et illisibles
test('T13–T14. LIGNES ANCIENNES : sans relation (.63.74–.64.4, .74) → jamais candidates ; avec relation (plate .64.5–.64.6, structurée .64.7–.64.28) → antécédent possible si autre acte, sans acquérir aucun groupe', async () => {
  const R = REL('soi:tour', 2, 1);
  const base = magasinMemoireVive();
  const modele = await ecrireC(base, { acte: 'acte-0', relation: R });
  const { reconnaissance, ...structureeAncienne } = { ...structuredClone(modele), id: 'attente-prospective-ancienne-structuree', references: { idContexte: 'contexte-x', idDesignation: 'acte-x' } };
  const plate645 = { ...plate(modele), id: 'attente-prospective-ancienne-plate', idDesignation: 'acte-y', idContexte: 'contexte-y' };
  const plateSans = { ...plate(modele, { sansRelation: true }), id: 'attente-prospective-ancienne-sans-relation', idDesignation: 'acte-z', idContexte: 'contexte-z' };
  const plate641 = { ...plate(modele), id: 'attente-prospective-ancienne-fondation-seule', idDesignation: 'acte-w', idContexte: 'contexte-w' }; delete plate641.relation;
  const septQuatre = { ...structuredClone(structureeAncienne), id: 'attente-prospective-74', references: { idContexte: 'contexte-v', idDesignation: 'acte-v' } };
  delete septQuatre.description.relation; delete septQuatre.preuve.fondation;
  const magasin = magasinMemoireVive();
  for (const l of [plateSans, plate641, septQuatre, plate645, structureeAncienne]) await magasin.ecrire('attentesProspectives', l);
  const avant = JSON.stringify(await magasin.lireTout('attentesProspectives'));
  const c = await ecrireC(magasin, { acte: 'acte-c', relation: R });
  assert.deepEqual(c.reconnaissance, { formulationsAnterieures: [{ idAttente: plate645.id, temoins: 'identiques' }, { idAttente: structureeAncienne.id, temoins: 'identiques' }], nonComparees: [] });
  const apres = await magasin.lireTout('attentesProspectives');
  assert.equal(JSON.stringify(apres.slice(0, 5)), avant, 'les anciennes lignes restent intactes : aucun groupe rétroactif');
  assert.equal(apres.slice(0, 5).some((l) => Object.hasOwn(l, 'reconnaissance')), false);
  // une ancienne ligne avec relation du MÊME acte n'est pas antécédent
  const m2 = magasinMemoireVive();
  await m2.ecrire('attentesProspectives', { ...plate645, idDesignation: 'acte-c' });
  assert.deepEqual((await ecrireC(m2, { acte: 'acte-c', relation: R })).reconnaissance, { formulationsAnterieures: [], nonComparees: [] });
});

test('T15–T16. ILLISIBLES : une ligne qui porte une relation brute mais que rolesDeLAttente refuse (ou dont l\'acte n\'est pas lisible) → nonComparees, C écrite quand même ; une ligne illisible SANS relation n\'entre pas dans nonComparees', async () => {
  const R = REL('soi:tour', 2, 1);
  const base = magasinMemoireVive();
  const m = await ecrireC(base, { acte: 'acte-0', relation: R });
  const { reconnaissance, ...ligne } = structuredClone(m);
  const illisibleStructuree = { ...structuredClone(ligne), id: 'attente-prospective-i1', source: 'x' };
  const illisiblePlate = { ...plate(m), id: 'attente-prospective-i2', source: 'x' };
  const illisibleRelationSansFondation = { ...structuredClone(ligne), id: 'attente-prospective-i3', preuve: { temoinsContexte: [], unitesIssues: [['u']] } };
  const acteIllisible = { ...structuredClone(ligne), id: 'attente-prospective-i4', references: { idContexte: 'c', idDesignation: 7 } };
  const reconnaissanceHorsForme = { ...structuredClone(m), id: 'attente-prospective-i5', references: { idContexte: 'c', idDesignation: 'acte-i5' }, reconnaissance: { formulationsAnterieures: [{ idAttente: 'a', temoins: 'plus' }], nonComparees: [] } };
  const relationNonParcourable = { ...structuredClone(ligne), id: 'attente-prospective-i6', references: { idContexte: 'c', idDesignation: 'acte-i6' }, description: { ...structuredClone(ligne.description), relation: { ...R, connu: { valeurs: { depart: Number.NaN } } } } };
  const sansRelation1 = { id: 'attente-prospective-s1', source: 'x' };
  const sansRelation2 = { ...structuredClone(ligne), id: 'attente-prospective-s2', description: { structure: [], chemin: [], constat: { type: 'x' } }, inconnue: 1 };
  const sansRelation3 = { ...plate(m, { sansRelation: true }), id: 'attente-prospective-s3', source: 'x' };
  const valide = { ...structuredClone(ligne), id: 'attente-prospective-ok', references: { idContexte: 'c', idDesignation: 'acte-ok' } };
  const magasin = magasinMemoireVive();
  for (const l of [illisibleStructuree, sansRelation1, illisiblePlate, valide, sansRelation2, illisibleRelationSansFondation, sansRelation3, acteIllisible, reconnaissanceHorsForme, relationNonParcourable]) await magasin.ecrire('attentesProspectives', l);
  const c = await ecrireC(magasin, { acte: 'acte-c', relation: R });
  assert.deepEqual(c.reconnaissance, { formulationsAnterieures: [{ idAttente: 'attente-prospective-ok', temoins: 'identiques' }], nonComparees: ['attente-prospective-i1', 'attente-prospective-i2', 'attente-prospective-i3', 'attente-prospective-i4', 'attente-prospective-i5', 'attente-prospective-i6'] });
  assert.ok((await magasin.lireTout('attentesProspectives')).some((l) => l.id === c.id), 'C écrite');
  identitesHonnetes(c.reconnaissance, await magasin.lireTout('attentesProspectives'));
  assert.deepEqual(rolesDeLAttente(c).reconnaissance, c.reconnaissance, 'C reste lisible');
});

// Garantie du contrat (correction avant dépôt, ChatGPT 16/10/2026) : chaque élément de nonComparees est une chaîne non vide, égale au champ
// propre `id` d'une ligne de l'instantané qui porte une relation brute ; jamais null, jamais un rang, jamais une identité inventée.
function identitesHonnetes(reconnaissance, instantane) {
  const relationBrute = (l) => l !== null && typeof l === 'object' && (Object.hasOwn(l, 'relation') || (l.description !== null && typeof l.description === 'object' && Object.hasOwn(l.description, 'relation')));
  for (const id of reconnaissance.nonComparees) {
    assert.equal(typeof id, 'string'); assert.ok(id.length > 0);
    const lignes = instantane.filter((l) => l !== null && typeof l === 'object' && Object.getOwnPropertyDescriptor(l, 'id')?.value === id);
    assert.equal(lignes.length, 1, `identité persistée d'une seule ligne : ${id}`);
    assert.ok(relationBrute(lignes[0]), `cette ligne porte une relation : ${id}`);
  }
}

test('T15b. IDENTITÉ NON REPRÉSENTABLE : une ligne qui porte une relation (lisible ou non) mais dont le champ propre id n\'est pas une chaîne non vide (absent, vide, nombre, tableau, accesseur) n\'entre ni dans nonComparees ni dans formulationsAnterieures ; jamais null, jamais d\'identité inventée ; C est écrite ; les autres lignes restent traitées', async () => {
  const R = REL('soi:tour', 2, 1);
  const base = magasinMemoireVive();
  const m = await ecrireC(base, { acte: 'acte-0', relation: R });
  const { reconnaissance, ...ligne } = structuredClone(m);
  const autreActe = (l, acte) => ({ ...l, references: { idContexte: `contexte-${acte}`, idDesignation: acte } });
  // relation LISIBLE par rolesDeLAttente (même relation, autre acte), identité non représentable
  const lisibleNombre = { ...autreActe(structuredClone(ligne), 'acte-n'), id: 7 };
  const lisibleVide = { ...autreActe(structuredClone(ligne), 'acte-v'), id: '' };
  const lisibleTableau = { ...autreActe(structuredClone(ligne), 'acte-t'), id: ['attente-prospective-x'] };
  const lisibleAccesseur = autreActe(structuredClone(ligne), 'acte-g'); delete lisibleAccesseur.id; Object.defineProperty(lisibleAccesseur, 'id', { get: () => 'attente-prospective-inventee', enumerable: true });
  // relation brute, ligne refusée par rolesDeLAttente, identité absente ou non représentable
  const { id: _id, ...sansId } = autreActe(structuredClone(ligne), 'acte-s');
  const illisibleNombre = { ...plate(m), id: 8, idDesignation: 'acte-p', source: 'x' };
  // témoins : une ligne normale reconnue, une ligne illisible nommée
  const valide = { ...autreActe(structuredClone(ligne), 'acte-ok'), id: 'attente-prospective-ok' };
  const illisibleNommee = { ...structuredClone(ligne), id: 'attente-prospective-illisible', source: 'x' };
  const instantane = [lisibleNombre, lisibleVide, sansId, valide, lisibleTableau, illisibleNombre, lisibleAccesseur, illisibleNommee];
  // la fonction pure, sur l'instantané exact (l'écrivain ne peut pas stocker une ligne sans clé : la mémoire vive l'accepterait sous undefined)
  const r = formulationsAnterieures(entree({ acte: 'acte-c', relation: R }).attente, instantane);
  assert.deepEqual(r, { formulationsAnterieures: [{ idAttente: 'attente-prospective-ok', temoins: 'identiques' }], nonComparees: ['attente-prospective-illisible'] });
  identitesHonnetes(r, instantane);
  assert.equal(JSON.stringify(r).includes('null'), false); assert.equal(JSON.stringify(r).includes('inventee'), false);
  // l'avertissement exact : ces lignes, avec un id valide, auraient été comparées (preuve que seule l'identité les écarte)
  const renommees = instantane.map((l, i) => { const c = { ...l }; delete c.id; return { ...c, id: `attente-prospective-r${i}` }; });
  const r2 = formulationsAnterieures(entree({ acte: 'acte-c', relation: R }).attente, renommees);
  assert.deepEqual(r2.formulationsAnterieures.map((a) => a.idAttente), ['attente-prospective-r0', 'attente-prospective-r1', 'attente-prospective-r2', 'attente-prospective-r3', 'attente-prospective-r4', 'attente-prospective-r6']);
  assert.deepEqual(r2.nonComparees, ['attente-prospective-r5', 'attente-prospective-r7']);
  // le vrai écrivain : C écrite, son groupe est lisible et ne contient que des identités persistées
  const magasin = magasinMemoireVive();
  for (const l of [lisibleNombre, lisibleVide, valide, lisibleTableau, illisibleNombre, illisibleNommee]) await magasin.ecrire('attentesProspectives', l);
  const c = await ecrireC(magasin, { acte: 'acte-c', relation: R });
  assert.deepEqual(c.reconnaissance, { formulationsAnterieures: [{ idAttente: 'attente-prospective-ok', temoins: 'identiques' }], nonComparees: ['attente-prospective-illisible'] });
  identitesHonnetes(c.reconnaissance, await magasin.lireTout('attentesProspectives'));
  assert.deepEqual(rolesDeLAttente(c).reconnaissance, c.reconnaissance);
  // la forme lue refuse null ou une chaîne vide dans nonComparees
  for (const x of [null, '', 3]) assert.throws(() => rolesDeLAttente({ ...c, reconnaissance: { formulationsAnterieures: [], nonComparees: [x] } }), TypeError);
});

test('T17. VRAI FLUX : nonComparees reste vide sur toutes les attentes conditionnées ; toutes les lignes v0.64.29 restent lisibles par rolesDeLAttente (le piège du groupe inconnu est fermé)', async () => {
  const { w } = await vecuPartage();
  const toutes = await w.magasin.lireTout('attentesProspectives');
  for (const l of toutes) {
    const r = rolesDeLAttente(l);
    assert.equal(Object.hasOwn(l, 'reconnaissance'), Object.hasOwn(r.description, 'relation'), 'reconnaissance ⇔ attente conditionnée');
    if (Object.hasOwn(l, 'reconnaissance')) { assert.deepEqual(l.reconnaissance.nonComparees, [], l.id); assert.deepEqual(r.reconnaissance, l.reconnaissance); }
  }
  assert.ok(toutes.filter((l) => l.reconnaissance && l.reconnaissance.formulationsAnterieures.length).length >= 10);
});

// ================================================================================================================ T18 contradiction
test('T18. CONTRADICTION : salut→oui puis salut→non → abstention inchangée (aucune nouvelle attente S2 pour l\'émission présente) ; rien n\'est produit, ressuscité ni départagé ; les lignes antérieures restent intactes', async () => {
  const w = monde();
  for (const [x, y] of [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'non']]) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tick(2); }
  const avant = JSON.stringify(await w.magasin.lireTout('attentesProspectives'));
  const E = await w.emettre('salut');
  const apres = await w.magasin.lireTout('attentesProspectives');
  assert.ok(JSON.stringify(apres).startsWith(avant.slice(0, -1)), 'rien de réécrit');
  const s2 = apres.filter((l) => l.description.relation && vue(l.description.relation.domaine) === S2);
  assert.ok(s2.length > 0, 'des formulations salut→oui antérieures existent');
  assert.equal(s2.some((l) => l.references.idDesignation === E.id), false, 'abstention : aucune attente S2 pour l\'émission présente, malgré les formulations antérieures');
  // même résultat sans aucun passé à reconnaître (magasin aveugle) : la reconnaissance ne change pas la décision
  const v = monde({ aveugle: true });
  for (const [x, y] of [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'non']]) { const F = await v.emettre(x); await v.tour(y, F.id); await v.tick(2); }
  const F = await v.emettre('salut');
  assert.equal((await v.magasin.lireTout('attentesProspectives')).some((l) => l.description.relation && vue(l.description.relation.domaine) === S2 && l.references.idDesignation === F.id), false);
});

// ================================================================================================================ T19 production inchangée
// Comparaison de deux vécus produits par le même scénario : identités renommées par ordre d'apparition, horodatages effacés, groupe
// reconnaissance retiré (seule différence admise).
function canonique(donnees) {
  const noms = new Map();
  const texte = JSON.stringify(donnees, (cle, valeur) => (cle === 'reconnaissance' || cle === 'retrouvaille' || cle === 'issuesRetrouvailles' ? undefined : valeur)); // MISE À JOUR DÉLIBÉRÉE v0.66.5 (C1) : la table issuesRetrouvailles conserve ce que la confrontation des groupes retrouvaille rend ; elle suit ces groupes et est exclue comme eux ; toutes les autres tables restent comparées // MISE À JOUR DÉLIBÉRÉE v0.64.31 (RETROUVAILLE-1) : le groupe retrouvaille des contextes lit lui aussi l'instantané aveuglé ; il est retiré comme la reconnaissance (seconde différence admise) ; tout le reste reste identique
  return texte.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, 'H').replace(/[a-z][a-z-]*-\d{13}-\d+-\d+/g, (id) => { if (!noms.has(id)) noms.set(id, `#${noms.size}`); return noms.get(id); });
}
const toutesLesTables = async (magasin) => { const o = {}; for (const t of TABLES) o[t] = await magasin.lireBrut(t); return o; };

test('T19. PRODUCTION DE C IDENTIQUE avec ou sans passé reconnu : (a) même entrée, magasin vide ou peuplé → description, preuve, references identiques ; (b) même scénario réel, lecture du passé aveuglée → toutes les tables identiques hors reconnaissance', async () => {
  const R = REL('soi:tour', 2, 1);
  const vide = magasinMemoireVive(); const peuple = magasinMemoireVive();
  for (const acte of ['acte-1', 'acte-2', 'acte-3']) await ecrireC(peuple, { acte, relation: R });
  const e = entree({ acte: 'acte-c', relation: R });
  const sans = await enregistrerAttenteProspective(vide, e);
  const avec = await enregistrerAttenteProspective(peuple, entree({ acte: 'acte-c', relation: R }));
  for (const role of ['description', 'preuve', 'references']) assert.deepEqual(avec[role], sans[role], role);
  assert.deepEqual(Object.keys(avec), ['id', 'horodatage', 'idObservation', 'description', 'preuve', 'references', 'reconnaissance']);
  assert.equal(avec.reconnaissance.formulationsAnterieures.length > 0 && sans.reconnaissance.formulationsAnterieures.length === 0, true);
  assert.deepEqual(e.attente, entree({ acte: 'acte-c', relation: R }).attente, 'l\'entrée n\'est pas modifiée');
  const reel = await vecuPartage();
  const aveugle = await vecuComplet({ aveugle: true });
  const tReel = await toutesLesTables(reel.w.magasin); const tAveugle = await toutesLesTables(aveugle.w.magasin);
  assert.equal(tReel.attentesProspectives.length, tAveugle.attentesProspectives.length);
  assert.ok(tAveugle.attentesProspectives.every((l) => !l.reconnaissance || (l.reconnaissance.formulationsAnterieures.length === 0 && l.reconnaissance.nonComparees.length === 0)));
  assert.ok(tReel.attentesProspectives.some((l) => l.reconnaissance && l.reconnaissance.formulationsAnterieures.length > 0));
  assert.equal(canonique(tReel), canonique(tAveugle), 'aucune autre différence : ni production, ni décision, ni écriture');
});

// ================================================================================================================ T20 ordre causal
test('T20. ORDRE CAUSAL : pour chaque C, garanties d\'ordre lues → lecture instantanée de attentesProspectives → UNE écriture ; tout antécédent est dans cet instantané, écrit AVANT C ; C ne s\'y trouve pas ; aucune ligne n\'est écrite entre la lecture et C', async () => {
  const { w } = await vecuPartage(); const journal = JOURNAL;
  const ecritures = journal.map((j, i) => ({ ...j, i })).filter((j) => j.op === 'ecrire' && j.table === 'attentesProspectives');
  let vues = 0;
  for (const C of ecritures) {
    const avantC = journal.slice(0, C.i);
    if (!Object.hasOwn(C.objet, 'reconnaissance')) { assert.equal(avantC.at(-1).op === 'lire' && avantC.at(-1).table === 'attentesProspectives', false, 'une attente .74 ne lit pas la table'); continue; }
    const k = avantC.findLastIndex((j) => j.op === 'lire' && j.table === 'attentesProspectives');
    assert.equal(k, C.i - 1, 'la lecture instantanée précède immédiatement l\'unique écriture');
    const instantane = journal[k].ids;
    assert.equal(instantane.includes(C.id), false, 'C ne se lit pas elle-même');
    assert.ok(avantC.slice(0, k).some((j) => j.op === 'lire' && j.table === 'executionsOperations'), 'garanties d\'ordre avant la lecture');
    const derniereGarantie = avantC.slice(0, k).findLastIndex((j) => j.op === 'lire' && j.table === 'executionsOperations');
    assert.equal(journal.slice(derniereGarantie, C.i).some((j) => j.op === 'ecrire'), false, 'rien n\'est écrit entre les garanties, la lecture et C');
    for (const id of [...C.objet.reconnaissance.formulationsAnterieures.map((a) => a.idAttente), ...C.objet.reconnaissance.nonComparees]) {
      assert.ok(instantane.includes(id), 'antécédent présent dans l\'instantané');
      assert.ok(ecritures.find((e) => e.id === id).i < C.i, 'antécédent écrit avant C');
    }
    vues += 1;
  }
  assert.ok(vues >= 20);
  // et aucune attente n'est réécrite ensuite : une ligne écrite n'est jamais complétée après coup
  assert.equal(new Set(ecritures.map((e) => e.id)).size, ecritures.length);
  for (const l of await w.magasin.lireTout('attentesProspectives')) assert.deepEqual(l, ecritures.find((e) => e.id === l.id).objet);
});

// ================================================================================================================ T21–T23 redémarrage, Diagnostic
test('T21. REDÉMARRAGE : la reconnaissance persistée est identique octet pour octet ; la vue Diagnostic aussi ; une écriture après redémarrage reconnaît les formulations d\'avant', async () => {
  const { w } = await vecuPartage();
  const avant = JSON.stringify(await w.magasin.lireTout('attentesProspectives'));
  const vueAvant = JSON.stringify(await pontAvant(w.magasin));
  const m2 = await redemarrer(w);
  assert.equal(JSON.stringify(await m2.lireTout('attentesProspectives')), avant);
  assert.equal(JSON.stringify(await pontAvant(m2)), vueAvant);
  const s2 = (await conditionnees(m2)).filter((l) => vue(l.description.relation.domaine) === S2);
  const c = await ecrireC(m2, { acte: 'acte-apres-redemarrage', relation: structuredClone(s2[0].description.relation) });
  assert.deepEqual(ids(c.reconnaissance), s2.map((l) => l.id));
});

test('T22. DIAGNOSTIC RECOPIE, NE RECOMPARE JAMAIS : avantIssue.reconnaissance = le groupe persisté ; une relation modifiée après coup ne change pas la reconnaissance affichée ; la vue n\'importe ni l\'égalité ni le calcul', async () => {
  const { w } = await vecuPartage();
  const lignes = structuredClone(await w.magasin.lireTout('attentesProspectives'));
  const actes = { designations: await w.magasin.lireTout('designations'), emissions: await w.magasin.lireTout('emissions'), observations: await w.magasin.lireTout('observationsPossibilites') };
  const sortie = relireAttentesConditionnees(lignes, actes);
  for (const x of sortie.attentes) {
    const l = lignes.find((y) => y.id === x.occurrence.idAttente);
    assert.deepEqual(x.avantIssue.reconnaissance, l.reconnaissance);
    assert.equal(Object.hasOwn(x.avantIssue, 'reconnaissanceAbsente'), false);
  }
  // falsifier toutes les relations : la reconnaissance relue ne bouge pas (aucun recalcul)
  const falsifiees = lignes.map((l) => (l.description && l.description.relation ? { ...l, description: { ...l.description, relation: { ...l.description.relation, connu: { valeurs: { depart: `autre-${l.id}` } } } } } : l));
  const sortie2 = relireAttentesConditionnees(falsifiees, actes);
  assert.deepEqual(sortie2.attentes.map((x) => x.avantIssue.reconnaissance), sortie.attentes.map((x) => x.avantIssue.reconnaissance));
  // une ligne écrite avant v0.64.29 : null + libellé de forme, jamais reconstruite
  const ancienne = lignes.find((l) => l.reconnaissance && l.reconnaissance.formulationsAnterieures.length);
  const { reconnaissance, ...sansGroupe } = ancienne;
  const x = relireAttentesConditionnees([sansGroupe], actes).attentes[0];
  assert.equal(x.avantIssue.reconnaissance, null); assert.equal(x.avantIssue.reconnaissanceAbsente, 'ligne-anterieure-a-la-reconnaissance');
  const code = sansCommentaires(lu('app', 'langage', 'attentes-conditionnees-persistees.js'));
  assert.doesNotMatch(code, /relations-formulees|memesRelations|formulationsAnterieures|parcourirStructure|memesCouvertures|memeActe/);
  assert.deepEqual([...code.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]), ['./roles-attente.js', './issue-attente-prospective.js']);
});

class Faux {
  get parentNode() { return this.parent; }
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.attrs = {}; this.open = false; }
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
  querySelector(sel) { const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, '')); const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; }; return parcourir(this); }
}
const textes = (e) => [e.textContent, ...e.children.flatMap(textes)].filter(Boolean);
const trouver = (e, f) => (f(e) ? e : e.children.map((c) => trouver(c, f)).find(Boolean) || null);
async function ecranAvec(capacite) {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  globalThis.window = globalThis;
  const { monterConversation } = await import('../app/conversation/ecran.js');
  const page = new Faux('main'); const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  page.append(liste, formulaire);
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: async () => ({ texte: 'ok' }), capacite });
  await conv.recharger();
  const zone = page.children.find((c) => c._cls.has('diagnostic'));
  const section = trouver(zone, (e) => e._cls.has('attentes-conditionnees-zone'));
  return { page, liste, zone, section };
}

test('T23. ÉCRAN : sous la relation, « FORMULATIONS ANTÉRIEURES RECONNUES À K0 » puis une ligne par attente (mêmes épisodes témoins / épisodes témoins différents) ; ou « aucune formulation antérieure reconnue à K0 » ; ou « reconnaissance non effectuée (ligne écrite avant v0.64.29) » ; non comparées listées ; aucun nombre', async () => {
  const relation = { domaine: [{ operation: 'f', entrees: ['e'] }], connu: { valeurs: { depart: 'salut' } }, attendu: { valeurs: { arrivee: 'oui' } } };
  const x = (id, reconnaissance) => ({ occurrence: { idAttente: id, horodatage: '2026-10-16T10:00:00.000Z', idObservation: 'observation-1' }, acte: { idActe: `emission-${id}`, table: 'emissions', environnement: 'conversation', operation: 'environnement:conversation' }, avantIssue: { statut: 'ecrit-avant-issue', relation, chemin: ['valeurs', 'arrivee'], constat: { type: 'chaine', valeur: 'oui' }, fondation: [{ conditions: [{ chemin: ['valeurs', 'depart'], type: 'chaine', valeur: 'salut' }], couverture: [['u1'], ['u2']], constats: [{ chemin: ['a'], type: 'chaine', valeur: 'x' }], temoinUnique: false }], idContexte: 'contexte-1', reconnaissance, ...(reconnaissance ? {} : { reconnaissanceAbsente: 'ligne-anterieure-a-la-reconnaissance' }) } });
  const capacite = {
    lire: async () => ({ valeur: 3, plafond: 3, derniere: null, besoins: [] }), repos: async () => ({}),
    attentesConditionnees: async () => ({ attentes: [
      x('ANCIENNE', null),
      x('PREMIERE', { formulationsAnterieures: [], nonComparees: [] }),
      x('SECONDE', { formulationsAnterieures: [{ idAttente: 'attente-prospective-1792133616037-310-210', temoins: 'identiques' }, { idAttente: 'attente-prospective-1792133616037-343-190', temoins: 'differents' }], nonComparees: [] }),
      x('AVEC-ILLISIBLE', { formulationsAnterieures: [], nonComparees: ['attente-prospective-1792133616037-9-9'] }),
    ], illisibles: [] }),
    issuesAujourdhui: async () => [],
  };
  const { section } = await ecranAvec(capacite);
  section.open = true; await Promise.all(section.listeners.toggle.map((f) => f()));
  const blocs = section.children.flatMap((c) => c.children).filter((d) => d.tag === 'details');
  const t = (i) => textes(blocs[i]);
  const apres = (i, texte) => { const l = t(i); const k = l.findIndex((y) => y.startsWith('relation persistée : ')); return l.slice(k + 1); };
  assert.equal(apres(0)[0], 'reconnaissance non effectuée (ligne écrite avant v0.64.29)');
  assert.equal(apres(1)[0], 'aucune formulation antérieure reconnue à K0');
  assert.deepEqual(apres(2).slice(0, 3), ['FORMULATIONS ANTÉRIEURES RECONNUES À K0', '- attente attente-prospective…310-210 · mêmes épisodes témoins', '- attente attente-prospective…343-190 · épisodes témoins différents']);
  assert.deepEqual(apres(3).slice(0, 2), ['aucune formulation antérieure reconnue à K0', '- non comparée à K0 (ligne illisible) : attente attente-prospective…9-9']);
  const tout = textes(section).join('\n');
  assert.doesNotMatch(tout, INTERDITS);
  const reconnues = textes(section).filter((y) => /FORMULATION|formulation|épisodes témoins|non comparée|reconnaissance/.test(y));
  assert.equal(reconnues.some((y) => /\d/.test(y.replace(/attente-prospective…\d+-\d+/g, '').replace(/K0/g, '').replace(/v0\.64\.29/g, ''))), false, 'aucun nombre dans les lignes de reconnaissance');
  // vrai flux : la section montre les reconnaissances persistées
  const { w } = await vecuPartage();
  const reel = await ecranAvec({ ...capacite, attentesConditionnees: async () => pontAvant(w.magasin), issuesAujourdhui: async () => [] });
  reel.section.open = true; await Promise.all(reel.section.listeners.toggle.map((f) => f()));
  const tr = textes(reel.section);
  assert.ok(tr.includes('FORMULATIONS ANTÉRIEURES RECONNUES À K0'));
  assert.ok(tr.includes('aucune formulation antérieure reconnue à K0'));
  assert.ok(tr.some((y) => / · mêmes épisodes témoins$/.test(y)) && tr.some((y) => / · épisodes témoins différents$/.test(y)));
  assert.equal(tr.some((y) => /non comparée/.test(y)), false);
});

// ================================================================================================================ T24–T27 gardes
test('T24. VOCABULAIRE ET ABSENCE DE COMPTE : aucun mot interdit dans le module, le bloc de l\'écrivain et l\'écran ; le groupe ne contient que des identités et deux libellés (aucun nombre, horodatage, copie de relation, tri) ; l\'écran n\'affiche aucune longueur', async () => {
  const module = sansCommentaires(lu('app', 'langage', 'relations-formulees.js'));
  assert.doesNotMatch(module, INTERDITS);
  assert.doesNotMatch(module, /\.sort\(|Date|Math\.random|magasin|lireTout|ecrire|setTimeout|localStorage|indexedDB|nouvelId|JSON\.stringify|horodatage/);
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  const i = conn.indexOf('export async function enregistrerAttenteProspective('); const bloc = conn.slice(i, conn.indexOf('\n}\n', i));
  assert.doesNotMatch(bloc, INTERDITS);
  const ui = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  const j = ui.indexOf('const TEMOINS_TEXTE'); const ecranBloc = ui.slice(j, ui.indexOf('function lignesAvantIssue(', j));
  assert.ok(j > 0);
  assert.doesNotMatch(ecranBloc, INTERDITS);
  assert.doesNotMatch(ecranBloc, /\.length\}|length\)|\.sort\(|\.reduce\(|filter\(/, 'aucune longueur affichée, aucun tri, aucun regroupement');
  const { w } = await vecuPartage();
  for (const l of await conditionnees(w.magasin)) {
    assert.deepEqual(Object.keys(l.reconnaissance), ['formulationsAnterieures', 'nonComparees']);
    for (const a of l.reconnaissance.formulationsAnterieures) { assert.deepEqual(Object.keys(a), ['idAttente', 'temoins']); assert.ok(['identiques', 'differents'].includes(a.temoins)); }
    const feuilles = JSON.stringify(l.reconnaissance).match(/[-\d.]+(?=[,}\]])/g);
    assert.equal(feuilles, null, 'aucun nombre');
  }
});

test('T25. FORME LUE (roles-attente) : groupe facultatif rendu à part ; refusé dans la forme plate, sans relation, hors forme ; copie neuve', async () => {
  const R = REL('soi:tour', 2, 1);
  const m = magasinMemoireVive();
  await ecrireC(m, { acte: 'acte-1', relation: R });
  const c = await ecrireC(m, { acte: 'acte-2', relation: R });
  const r = rolesDeLAttente(c);
  assert.deepEqual(Object.keys(r), ['occurrence', 'description', 'preuve', 'references', 'reconnaissance']);
  assert.deepEqual(r.reconnaissance, c.reconnaissance); assert.notEqual(r.reconnaissance, c.reconnaissance);
  r.reconnaissance.formulationsAnterieures.push({ idAttente: 'x', temoins: 'identiques' }); assert.equal(c.reconnaissance.formulationsAnterieures.length, 1);
  const refuse = (ligne, nom) => assert.throws(() => rolesDeLAttente(ligne), TypeError, nom);
  refuse({ ...plate(c), reconnaissance: c.reconnaissance }, 'forme plate');
  const sansRelation = structuredClone(c); delete sansRelation.description.relation; delete sansRelation.preuve.fondation; refuse(sansRelation, 'sans relation');
  for (const [nom, g] of [['nombre', { formulationsAnterieures: [], nonComparees: [], compte: 1 }], ['manquant', { formulationsAnterieures: [] }], ['temoins inconnu', { formulationsAnterieures: [{ idAttente: 'a', temoins: 'meilleurs' }], nonComparees: [] }], ['clé en plus', { formulationsAnterieures: [{ idAttente: 'a', temoins: 'identiques', rang: 1 }], nonComparees: [] }], ['identité vide', { formulationsAnterieures: [{ idAttente: '', temoins: 'identiques' }], nonComparees: [] }], ['non comparée nombre', { formulationsAnterieures: [], nonComparees: [3] }], ['non comparée null', { formulationsAnterieures: [], nonComparees: [null] }], ['non comparée vide', { formulationsAnterieures: [], nonComparees: [''] }], ['tableau', []]]) refuse({ ...c, reconnaissance: g }, nom);
  assert.equal(VERSION_BASE, 30); assert.equal(SCHEMA_SAUVEGARDE, 20); assert.equal(TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
});

test('T26. ATTENTE .74 : aucune lecture de attentesProspectives, aucun groupe reconnaissance ; une attente refusée par les garanties d\'ordre ne lit pas la table', async () => {
  const journal = [];
  const magasin = instrumenter(magasinMemoireVive(), { aveugle: false, journal });
  const e = entree({ acte: 'acte-74', relation: REL('f', 1, 2) });
  delete e.attente.description.relation; delete e.attente.preuve.fondation;
  const l = await enregistrerAttenteProspective(magasin, e);
  assert.equal(Object.hasOwn(l, 'reconnaissance'), false);
  assert.equal(journal.some((j) => j.op === 'lire' && j.table === 'attentesProspectives'), false);
  journal.length = 0;
  await magasin.ecrire('executionsOperations', { id: 'execution-1', idDesignation: 'acte-issu' });
  await assert.rejects(ecrireC(magasin, { acte: 'acte-issu', relation: REL('f', 1, 2) }), /son exécution existe déjà/);
  assert.equal(journal.some((j) => j.op === 'lire' && j.table === 'attentesProspectives'), false, 'les garanties passent avant la lecture');
});

test('T27. GARDES STATIQUES : deux exports ; trois imports exacts ; seul connaissances.js importe le module, dans enregistrerAttenteProspective, une seule fois ; seuls l\'écrivain, la forme lue, la vue Diagnostic et l\'écran nomment le groupe ; aucun mécanisme de décision ne le lit', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['formulationsAnterieures', 'memesRelations']);
  const code = sansCommentaires(lu('app', 'langage', 'relations-formulees.js'));
  assert.deepEqual([...code.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]), ['./roles-attente.js', './parcours-structure.js', './couverture-occurrences.js']);
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /relations-formulees|memesRelations|formulationsAnterieures/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  // MISE À JOUR DÉLIBÉRÉE v0.66.14 (C2) : + app/langage/rappels.js dans les importeurs ; calcul pur du rappel, il compare la relation retrouvée des contextes à R par memesRelations, SEULE égalité de relation ; aucune reconnaissance lue, aucune écriture
  assert.deepEqual(importeurs, /* MISE À JOUR DÉLIBÉRÉE v0.66.14 (C2) : + rappels.js, calcul pur du rappel comparant les relations par memesRelations seulement */ ['app/conversation/ecran.js', 'app/langage/connaissances.js', 'app/langage/issue-retrouvaille.js' /* MISE À JOUR DÉLIBÉRÉE v0.64.33 (confronter une relation retrouvée à ce qui est arrivé) : issue-retrouvaille.js, vue pure lue SEULEMENT par le pont Diagnostic de main.js, réutilise exactement les primitives exigées par la mission (issuesDuContexteProspectifSurVue, episodesDeTransformation, parcourirStructure, restreindreParcours, reconstruireStructure, memesCouvertures, memesRelations) ; aucune seconde notion d'égalité, aucune écriture ; gardée par tests/issue-retrouvaille.test.mjs */, 'app/langage/rappels.js', 'app/langage/relations-formulees.js', 'app/langage/retrouvaille-forme.js', 'app/langage/retrouvailles.js', 'app/langage/roles-attente.js']); // MISE À JOUR DÉLIBÉRÉE v0.64.31 (RETROUVAILLE-1) : + retrouvaille-forme.js (forme du groupe : deux relations d'un groupe sont distinctes au sens de memesRelations) et retrouvailles.js, qui réutilisent memesRelations comme SEULE égalité de relation (exigé par la mission ; aucune seconde notion d'égalité)
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  assert.equal((conn.match(/formulationsAnterieures\(/g) || []).length, 1);
  assert.equal((conn.match(/lireTout\('attentesProspectives'\)/g) || []).length, 2); // MISE À JOUR DÉLIBÉRÉE v0.64.31 (RETROUVAILLE-1) : 1 → 2 ; la seconde lecture est la garantie d'ordre de enregistrerContexteProspectif (refus d'une retrouvaille si une attente de l'acte existe déjà), sans aucun lien avec la reconnaissance
  { const k = conn.indexOf('export async function enregistrerContexteProspectif('); const blocC = conn.slice(k, conn.indexOf('\n}\n', k)); assert.equal((blocC.match(/lireTout\('attentesProspectives'\)/g) || []).length, 1); assert.doesNotMatch(blocC, /formulationsAnterieures|reconnaissance/); } // MISE À JOUR DÉLIBÉRÉE v0.64.31 (RETROUVAILLE-1) : la seconde lecture est dans l'écrivain des contextes, une seule fois, sans reconnaissance
  const i = conn.indexOf('export async function enregistrerAttenteProspective('); const bloc = conn.slice(i, conn.indexOf('\n}\n', i));
  assert.ok(bloc.includes('formulationsAnterieures(') && bloc.includes("lireTout('attentesProspectives')"));
  assert.ok(bloc.indexOf("lireTout('executionsOperations')") < bloc.indexOf("lireTout('attentesProspectives')") && bloc.indexOf('issueDeVariationExiste(') < bloc.indexOf("lireTout('attentesProspectives')"), 'garanties avant la lecture');
  assert.ok(bloc.indexOf("lireTout('attentesProspectives')") < bloc.indexOf("nouvelId('attente-prospective')") && bloc.indexOf("nouvelId('attente-prospective')") < bloc.indexOf("ecrire('attentesProspectives'"), 'lecture, construction, écriture');
  assert.equal((bloc.match(/ecrire\(/g) || []).length, 1, 'une seule écriture');
  // aucun mécanisme vivant, de décision ou de production ne nomme le groupe
  const lecteurs = fichiersJs(join(RACINE, 'app')).filter((f) => /\.reconnaissance\b|reconnaissance:|'reconnaissance'|formulationsAnterieures|nonComparees/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(lecteurs, ['app/conversation/ecran.js', 'app/langage/attentes-conditionnees-persistees.js', 'app/langage/connaissances.js', 'app/langage/relations-formulees.js', 'app/langage/retrouvaille-forme.js', 'app/langage/retrouvailles.js', 'app/langage/roles-attente.js']); // MISE À JOUR DÉLIBÉRÉE v0.64.31 (RETROUVAILLE-1) : + retrouvaille-forme.js et retrouvailles.js, à cause du seul champ nonComparees de leur PROPRE groupe ; il ne lit pas la reconnaissance (assertion ci-dessous)
  for (const m of ['retrouvailles', 'retrouvaille-forme', 'retrouvailles-persistees']) assert.doesNotMatch(sansCommentaires(lu('app', 'langage', `${m}.js`)), /reconnaissance|formulationsAnterieures/, `${m} : la retrouvaille ne lit pas la reconnaissance .29 (invariant 12)`); // MISE À JOUR DÉLIBÉRÉE v0.64.31 (RETROUVAILLE-1) : invariant 12, la reconnaissance ne donne aucun poids
  for (const f of ['attentes-conditionnees', 'attentes-prospectives', 'capacite', 'prospection-soi', 'environnement-conversation', 'execution-sollicitee', 'execution-mecanique', 'episode-propre', 'tick-propre', 'resolutions', 'attentes-du-tour', 'issue-attente-prospective', 'experiences-attentes', 'confrontations-attentes']) {
    assert.doesNotMatch(sansCommentaires(lu('app', 'langage', `${f}.js`)), /reconnaissance|relations-formulees|memesRelations/, f);
  }
  for (const autre of ['sw.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.doesNotMatch(s, /relations-formulees/, autre); }
});
