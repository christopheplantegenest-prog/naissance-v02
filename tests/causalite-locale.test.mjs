// === DEBUT_TEST_CAUSALITE_LOCALE ===
// v0.63.94 — CAUSALITÉ LOCALE : APPLICATION « DÉTERMINÉE RELATIVEMENT À L'OBSERVATION » (décision ChatGPT « DÉCISION MINI-CONCEPTION CAUSALITÉ
// LOCALE », 12/10/2026). Un groupe laissé en choix dont exactement une entrée ordinaire porte la donnée observée par O (O.idMessage), toutes les
// autres entrées ordinaires étant univoques et les relations respectées, donne UNE application relative, AJOUTÉE au lot (jamais de filtre).
// .93 s'applique ensuite (déjà exécutée → non relancée) ; B1 : un coût au plus par tour. Tests obligatoires C1–C15.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES } from '../app/langage/connaissances.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee, executerApplicationAvecOrigine } from '../app/langage/execution-sollicitee.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { lireCapacite, tourActif, peutAgir } from '../app/langage/capacite.js';
import { lireRelation, consequenceReception } from '../app/langage/relation.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { BESOIN_RELATION, lireBesoins, moyensParStrategie, cleApplication } from '../app/langage/besoins.js';
import { traiterOccasion, relireEpisode, rotationDActualisation } from '../app/langage/episode-propre.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');

// RECONSTITUTION D'UNE BASE ANCIENNE (D7, D12) : copie À L'IDENTIQUE du corps du lot v0.63.92 (toutes les applications déterminées, connues ou non).
// Utilisée UNIQUEMENT pour construire un passé vécu sous .60–.92 ; tout ce qui suit dans ces tests est vécu sous .93.
async function lotAncien92({ observation, univers }, { magasin, table }) {
  const descriptions = DESCRIPTIONS_OPERATIONS;
  const { applications, choixAFaire } = applicationsSollicitables(observation, descriptions, univers);
  const resultats = [];
  for (const application of applications) {
    const r = await executerApplicationAvecOrigine({ observation, application, univers }, { magasin, table, descriptions }, 'mecanique');
    resultats.push({ operation: application.operation, statut: r.statut, designation: r.designation, execution: r.execution, erreur: r.erreur });
  }
  return { applications, choixAFaire, resultats };
}

// Le PIPELINE RÉEL de main.js : observation → porte B1 → lot (.93) → émission → tourActif si ≥ 1 exécution NOUVELLE ; réception → conséquence B2 ;
// événements → traiterOccasion ; tick idem. `ancien` : lot .92 (base ancienne) ; `coutFixture` : primitive B1 de fixture (prérequis d'état c).
function monde(depart = 0, magasinInitial = null) {
  const magasin = magasinInitial ?? magasinMemoireVive(); let n = depart; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null, { ancien = false, coutFixture = false } = {}) {
    let capacite = null;
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin); const porte = !peutAgir(avant);
      const lot = porte ? { applications: [], choixAFaire: [], resultats: [], dejaExecutees: [] } : await (ancien ? lotAncien92 : executerApplicationsDeterminees)({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      let variation = null;
      if (lot.resultats.some((r) => r.statut === 'executee') || (coutFixture && !porte)) variation = (await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage })).variation;
      capacite = { avant: avant.valeur, apres: (await lireCapacite(magasin)).valeur, porte, variation };
      return { ...lot, emises, echecEmission: echec, capacite };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation; let reception = null;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); reception = d.reception; await consequenceReception(magasin, d.reception); }
    const episodes = []; for (const ev of [s.observation.id, reception ? reception.id : null].filter(Boolean)) episodes.push(await traiterOccasion(magasin, ev));
    return { ...s, capacite, reception, episodes };
  }
  async function tick() { const t = await tickPropre(magasin); return { ...t, episode: await traiterOccasion(magasin, t.tick.id) }; }
  async function exterieur(s, application) { return executerApplicationSollicitee({ observation: s.observation, application, univers: s.univers }, { magasin, table: TABLE_OPERATIONS }); }
  return { magasin, tour, tick, exterieur, ticks: async (k) => { const o = []; for (let i = 0; i < k; i += 1) o.push(await tick()); return o; }, vecu: () => lireExecutionsVecues(magasin) };
}
const rows = (w, t) => w.magasin.lireTout(t);
const compte = async (w) => ({ obs: (await rows(w, 'observationsPossibilites')).length, ex: (await rows(w, 'executionsOperations')).length, em: (await rows(w, 'emissions')).length, d: (await rows(w, 'designations')).length, vc: (await rows(w, 'variationsCapacite')).length, att: (await rows(w, 'attentesProspectives')).length, ctx: (await rows(w, 'contextesProspectifs')).length });
const coutsDe = async (w, idObservation) => (await rows(w, 'variationsCapacite')).filter((v) => v.cause.type === 'tour' && v.cause.id === idObservation);
const copie = async (m) => { const x = magasinMemoireVive(); await x.remplacerTout(Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await m.lireTout(t)])))); return x; };
const clesExecutees = async (w) => new Set((await rows(w, 'executionsOperations')).map((x) => cleApplication(x)));
const SATURATION = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max'];
import { applicationsRelativesA } from '../app/langage/determination-relative.js';
import { classerCombinaisons } from '../app/langage/applications-sollicitables.js';
import { identifierMessage } from '../app/langage/pont.js';

// Monde saturé (2, 4, 9 + causales), puis un repos : c > 0 au message suivant.
async function sature(w) { const t = []; for (const m of SATURATION.slice(0, 3)) t.push(await w.tour(m)); await w.tick(); return t; }
const lie = (a, entree) => a.liaisons.find((l) => l.entree === entree);
const relativeDe = (s, op) => s.relatives.find((a) => a.operation === op);
// Fixtures pures : descripteurs SYNTHÉTIQUES (la fonction reçoit le catalogue en paramètre) pour les cas multi-entrées absents du catalogue réel.
const Q = { forme: 'quelconque', peutEtreNull: true };
const SORTIE = { forme: 'scalaire', genre: 'chaine' };
const D_PAIRE = [{ nom: 'paire', entrees: { a: Q, b: Q }, sortie: SORTIE }];
const D_REL = [{ nom: 'couvrir', entrees: { s: { forme: 'collection', elements: { forme: 'quelconque' } }, p: { forme: 'collection', elements: { forme: 'quelconque' } } }, sortie: SORTIE, relations: [{ relation: 'plagesDansSequence', plages: 'p', sequence: 's' }] }];
const at = (donnee, operation, entree) => ({ donnee, operation, entree });
const uv = (id, valeur) => ({ donnee: { identite: id, forme: { forme: 'quelconque' } }, porteur: { id, valeur }, acces: { champ: 'valeur' } });

test('C1. symbolesDeChaine : ancien concurrent (chaîne produite) + donnée de O → application relative = la donnée de O', async () => {
  const w = monde(); await sature(w); const s = await w.tour('il fait beau');
  const O = s.observation; const cands = O.possibilites.filter((p) => p.operation === 'symbolesDeChaine').map((p) => p.donnee);
  assert.equal(cands.length, 2); assert.ok(cands.includes(O.idMessage)); assert.ok(cands.some((d) => d !== O.idMessage), 'un concurrent historique');
  assert.deepEqual(relativeDe(s, 'symbolesDeChaine'), { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: O.idMessage }] });
  assert.deepEqual(applicationsRelativesA(O, DESCRIPTIONS_OPERATIONS, s.univers), s.relatives, 'pure et identique au lot');
  assert.ok(s.automatiques.some((r) => r.operation === 'symbolesDeChaine' && r.statut === 'executee' && r.designation.origine === 'mecanique' && lie(r.designation, 'chaine').donnee === O.idMessage));
});

test('C2. parcourirStructure : nombreux concurrents (≥ 30) + donnée de O → application relative = la donnée de O', async () => {
  const w = monde(); await sature(w); const s = await w.tour('il fait beau');
  const O = s.observation; const c = classerCombinaisons(O, DESCRIPTIONS_OPERATIONS, s.univers).find((k) => k.operation === 'parcourirStructure');
  assert.ok(c.brutes >= 30, String(c.brutes)); assert.equal(c.valides, null);
  assert.deepEqual(relativeDe(s, 'parcourirStructure'), { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: O.idMessage }] });
});

test('C3. DISTINGUER, JAMAIS FILTRER : les concurrents historiques restent dans les possibilités et dans les choix ; applicationsSollicitables est inchangée', async () => {
  const w = monde(); await sature(w); const s = await w.tour('il fait beau'); const O = s.observation;
  assert.ok(s.choixAFaire.includes('symbolesDeChaine')); assert.ok(s.choixAFaire.includes('parcourirStructure'));
  assert.equal(O.possibilites.filter((p) => p.operation === 'parcourirStructure').length, classerCombinaisons(O, DESCRIPTIONS_OPERATIONS, s.univers).find((k) => k.operation === 'parcourirStructure').brutes);
  const presentables = applicationsSollicitables(O, DESCRIPTIONS_OPERATIONS, s.univers);
  assert.equal(presentables.applications.some((a) => a.operation === 'symbolesDeChaine' || a.operation === 'parcourirStructure'), false, 'la relative n\'est pas une application déterminée par structure');
  assert.deepEqual(presentables.choixAFaire, s.choixAFaire);
});

test('C4. deux entrées ordinaires portant toutes deux la donnée de O → AUCUNE détermination relative (jamais a = b)', () => {
  const O = { id: 'o', idMessage: 'M', possibilites: [at('M', 'paire', 'a'), at('X', 'paire', 'a'), at('M', 'paire', 'b'), at('Y', 'paire', 'b')] };
  assert.deepEqual(applicationsRelativesA(O, D_PAIRE, []), []);
  assert.deepEqual(applicationsSollicitables(O, D_PAIRE, []).choixAFaire, ['paire'], 'reste un choix');
});

test('C5. une autre entrée ordinaire reste multiple → aucune détermination relative ; univoque → relative (contrôle)', () => {
  const multiple = { id: 'o', idMessage: 'M', possibilites: [at('M', 'paire', 'a'), at('X', 'paire', 'a'), at('Y', 'paire', 'b'), at('Z', 'paire', 'b')] };
  assert.deepEqual(applicationsRelativesA(multiple, D_PAIRE, []), []);
  const univoque = { id: 'o', idMessage: 'M', possibilites: [at('M', 'paire', 'a'), at('X', 'paire', 'a'), at('Y', 'paire', 'b')] };
  assert.deepEqual(applicationsRelativesA(univoque, D_PAIRE, []), [{ operation: 'paire', liaisons: [{ entree: 'a', donnee: 'M' }, { entree: 'b', donnee: 'Y' }] }]);
});

test('C6. relation déclarée REFUSANT la combinaison de O → aucune détermination relative ; relation l\'acceptant → relative (contrôle)', () => {
  const O = { id: 'o', idMessage: 'M', possibilites: [at('M', 'couvrir', 's'), at('X', 'couvrir', 's'), at('Z', 'couvrir', 's'), at('P', 'couvrir', 'p')] };
  const refus = [uv('M', 'pas une suite'), uv('X', [1, 2]), uv('Z', [3]), uv('P', [])];
  assert.equal(classerCombinaisons(O, D_REL, refus)[0].valides.length, 2, 'deux combinaisons valides, sans la donnée de O');
  assert.deepEqual(applicationsRelativesA(O, D_REL, refus), []);
  const accord = [uv('M', [9]), uv('X', [1, 2]), uv('Z', [3]), uv('P', [])];
  assert.deepEqual(applicationsRelativesA(O, D_REL, accord), [{ operation: 'couvrir', liaisons: [{ entree: 'p', donnee: 'P' }, { entree: 's', donnee: 'M' }] }]); // ordre canonique des entrées (groupesDeCandidats)
});

test('C7. entrée COLLECTIVE → jamais réduite à la donnée de O (elle prend tout, par structure) ; dans la vie réelle, aucune relative n\'a de liaison collective réduite', async () => {
  const O = { id: 'o', idMessage: 'M', possibilites: [at('M', 'elementsObservables', 'elements'), at('X', 'elementsObservables', 'elements')] };
  assert.deepEqual(applicationsRelativesA(O, DESCRIPTIONS_OPERATIONS, []), []);
  assert.deepEqual(applicationsSollicitables(O, DESCRIPTIONS_OPERATIONS, []).applications, [{ operation: 'elementsObservables', liaisons: [{ entree: 'elements', donnees: ['M', 'X'] }] }]);
  const w = monde(); await sature(w); for (const m of ['a', 'b']) { const s = await w.tour(m); await w.tick(); for (const a of s.relatives) for (const l of a.liaisons) assert.equal(Object.hasOwn(l, 'donnees'), false); }
});

test('C8. une production historique (même celle du tour précédent) n\'est JAMAIS locale au nouveau O ; sans donnée observée, aucune relative', async () => {
  const w = monde(); await sature(w);
  const s1 = await w.tour('premier'); await w.tick(); const s2 = await w.tour('second');
  const productionsDeS1 = new Set(s1.automatiques.map((r) => r.execution.id));
  for (const a of s2.relatives) for (const l of a.liaisons) { assert.equal(l.donnee, s2.observation.idMessage); assert.equal(productionsDeS1.has(l.donnee), false); }
  assert.ok(s2.observation.possibilites.some((p) => productionsDeS1.has(p.donnee)), 'les productions de s1 sont bien candidates en s2 (et restent des choix)');
  const sansDonnee = { ...s2.observation, idMessage: undefined };
  assert.deepEqual(applicationsRelativesA(sansDonnee, DESCRIPTIONS_OPERATIONS, s2.univers), []);
});

test('C9. application relative DÉJÀ exécutée → .93 : aucune réexécution, aucune émission, aucun coût', async () => {
  const w = monde(); await sature(w); const s = await w.tour('il fait beau'); assert.ok(s.relatives.length > 0);
  // même donnée observée une seconde fois (même identité), univers à jour : les relatives sont connues
  const message = { id: s.observation.idMessage, texte: 'il fait beau' };
  const o = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(w.magasin, d), lireExecutions: () => w.magasin.lireTout('executionsOperations') });
  const avant = await compte(w);
  const lot = await executerApplicationsDeterminees({ observation: o.observation, univers: o.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS });
  assert.deepEqual(lot.relatives.map((a) => cleApplication(a)).sort(), s.relatives.map((a) => cleApplication(a)).sort());
  for (const a of lot.relatives) assert.ok(lot.dejaExecutees.some((d) => cleApplication(d) === cleApplication(a)), 'déjà exécutée');
  assert.equal(lot.resultats.some((r) => s.relatives.some((a) => a.operation === r.operation)), false);
  const { emises } = await emettreLot(lot, { magasin: w.magasin, idObservation: o.observation.id });
  assert.equal(emises.length, lot.resultats.length);
  const apres = await compte(w); assert.equal(apres.vc, avant.vc, 'aucun coût');
});

test('C10. deux messages DIFFÉRENTS de même TEXTE → deux identités → deux applications strictes → deux exécutions (B1 ouverte), jamais dédupliquées par le texte', async () => {
  const w = monde(); await sature(w);
  const s1 = await w.tour('bonjour'); await w.tick(); const s2 = await w.tour('bonjour');
  assert.notEqual(s1.observation.idMessage, s2.observation.idMessage);
  const k1 = cleApplication(relativeDe(s1, 'symbolesDeChaine')); const k2 = cleApplication(relativeDe(s2, 'symbolesDeChaine'));
  assert.notEqual(k1, k2);
  for (const s of [s1, s2]) { assert.ok(s.automatiques.some((r) => r.operation === 'symbolesDeChaine' && r.statut === 'executee')); assert.equal((await coutsDe(w, s.observation.id)).length, 1); }
  assert.equal(/texte\s*===|\.texte\b/.test(sansCommentaires(lu('app', 'langage', 'determination-relative.js'))), false, 'aucune lecture du texte');
});

test('C11. message sans nouvelle application exécutable (porte fermée) → observation OUI, acte 0, coût 0 (OBSERVER ≠ AGIR)', async () => {
  const w = monde(); await w.tour('bonjour Pixel');
  for (const k of [1, 2]) await tourActif(w.magasin, { idObservation: `fixture-cout-${k}`, horodatage: new Date().toISOString() });
  const avant = await compte(w); const s = await w.tour('il fait beau'); const apres = await compte(w);
  assert.equal(s.capacite.porte, true); assert.deepEqual(s.automatiques, []);
  assert.equal(apres.obs, avant.obs + 1); assert.equal(apres.ex, avant.ex); assert.equal(apres.vc, avant.vc); assert.equal(apres.em, avant.em);
});

test('C12. plusieurs nouvelles applications (structure ET relatives) dans le même tour → UN seul coût B1', async () => {
  const w = monde(); await sature(w); const s = await w.tour('il fait beau');
  const rel = new Set(s.relatives.map((a) => a.operation));
  assert.ok(s.automatiques.some((r) => rel.has(r.operation)) && s.automatiques.some((r) => !rel.has(r.operation)), 'les deux genres dans le lot');
  assert.ok(s.automatiques.length >= 3);
  assert.equal((await coutsDe(w, s.observation.id)).length, 1); assert.equal(s.capacite.apres, s.capacite.avant - 1);
});

test('C13. les ambiguïtés historiques ne sont JAMAIS explorées : après saturation, aucune nouvelle exécution des opérations restées en choix ; toute exécution mécanique de symbolesDeChaine / parcourirStructure est liée à la donnée observée de son O', async () => {
  const w = monde(); await sature(w);
  const CHOIX = ['composerCollection', 'memesCouvertures', 'normaliserCouverture', 'partagerCouvertures', 'produireConstatsStructurels', 'produireSuitesFermees', 'projeterChemins', 'projeterContenus', 'rechercherSousSuites', 'resoudreCouverture', 'resoudreElements'];
  const parOp = async () => { const ex = await rows(w, 'executionsOperations'); return Object.fromEntries(CHOIX.map((op) => [op, ex.filter((e) => e.operation === op).length])); };
  const avant = await parOp();
  const vus = [];
  for (const m of ['a', 'b', 'c', 'd']) { const s = await w.tour(m); vus.push(s); await w.tick(); for (const op of CHOIX) assert.ok(s.choixAFaire.includes(op) || !s.observation.possibilites.some((p) => p.operation === op), op); }
  assert.deepEqual(await parOp(), avant, 'aucune exploration');
  const observations = new Map((await rows(w, 'observationsPossibilites')).map((o) => [o.id, o]));
  for (const s of vus) for (const d of (await rows(w, 'designations')).filter((x) => x.idObservation === s.observation.id && x.origine === 'mecanique' && (x.operation === 'symbolesDeChaine' || x.operation === 'parcourirStructure'))) assert.equal(d.liaisons[0].donnee, observations.get(d.idObservation).idMessage);
});

test('C14. rotation .92 INCHANGÉE ; episode-propre.js, besoins.js, capacite.js ignorent la détermination relative', () => {
  const strat = (operation, id = operation) => ({ operation, production: `p-${id}`, application: { operation, liaisons: [{ entree: 'e', donnee: `d-${id}` }] } });
  const A = strat('parcourirStructure'); const B = strat('symbolesDeChaine');
  assert.equal(rotationDActualisation([B, A], []).actualisee.operation, 'parcourirStructure');
  assert.equal(rotationDActualisation([A, B], [{ cle: cleApplication(A.application) }]).actualisee.operation, 'symbolesDeChaine');
  assert.equal(rotationDActualisation([strat('elementsObservables', 1), strat('elementsObservables', 2)], []).ordonnable, false);
  for (const f of ['episode-propre.js', 'besoins.js', 'capacite.js', 'environnement-conversation.js']) assert.equal(/applicationsRelativesA|determination-relative|relatives/.test(sansCommentaires(lu('app', 'langage', f))), false, f);
});

test('C15. REDÉMARRAGE / RELECTURE : la détermination relative se reconstruit à partir de O.idMessage et des faits examinés par O', async () => {
  const w = monde(); await sature(w); const s = await w.tour('il fait beau'); const O = s.observation;
  const neuf = await copie(w.magasin);
  const examinees = new Set(O.donneesExaminees);
  const message = { id: O.idMessage, texte: 'il fait beau' };
  const o2 = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(neuf, d), lireExecutions: async () => (await neuf.lireTout('executionsOperations')).filter((e) => examinees.has(e.id)) });
  assert.equal(o2.observation.idMessage, O.idMessage);
  assert.deepEqual(applicationsRelativesA(o2.observation, DESCRIPTIONS_OPERATIONS, o2.univers), s.relatives);
  assert.ok(identifierMessage);
});
// === FIN_TEST_CAUSALITE_LOCALE ===
