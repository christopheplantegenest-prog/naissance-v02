// v0.64.1 — ATTENTE CONDITIONNÉE PAR LA PARTIE CONNUE (décision ChatGPT « DÉCISION v0.64.1 », 13/10/2026).
// Une classe de co-couverture EXACTE de l'histoire comparable, dont chaque membre CONNU dans le présent porte exactement son constat historique
// (au moins un), engage le constat historique de ses membres situés sur un chemin OUVERT. Source distincte de .74 (champ `fondation`).
// Cas obligatoires A–J, persistance, gardes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { raccordsConditionnes, attentesConditionneesDesContextes } from '../app/langage/attentes-conditionnees.js';
import { coCouverturesParChemins } from '../app/langage/co-couvertures.js';
import { episodesDeTransformation, partieConnueEpisode } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { issuesDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
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

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const S2 = 'symbolesDeChaine(chaine)>environnement:conversation(emis)';
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const nom = (c) => c.join('.');
const CHAINE = (valeur) => ({ type: 'chaine', valeur });

// ------------------------------------------------------------------------------------------------------------------------------- vécu réel
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
async function histoire(paires, present) {
  const w = monde();
  for (const [x, y] of paires) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tick(2); }
  const E = await w.emettre(present);
  return { w, E, ...(await photo(w, E)) };
}
async function photo(w, E) {
  const contexte = (await w.magasin.lireTout('contextesProspectifs')).find((c) => c.idDesignation === E.id && vue(c.structure) === S2);
  const lignes = (await w.magasin.lireTout('attentesProspectives')).filter((a) => a.idContexte === contexte.id);
  return { contexte, universelles: lignes.filter((a) => !Object.hasOwn(a, 'fondation')), conditionnees: lignes.filter((a) => Object.hasOwn(a, 'fondation')), v: await lireExecutionsVecues(w.magasin) };
}
// Ce que font les quatre sites : la vue de ces lignes, calculée une fois, transmise explicitement.
const duVecu = (contextes, designation, valeurs, executions, descriptions) => attentesConditionneesDesContextes(contextes, designation, valeurs, executions, descriptions, episodesDeTransformation(valeurs, executions, descriptions));
const resume = (l) => l.map((a) => [nom(a.chemin), a.constat]);
const CANON = [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui']];

// ------------------------------------------------------------------------------------------------------------------------------- épisodes synthétiques
// Épisode minimal d'une famille (une étape f(e)), champs observés quelconques au premier niveau. Identité = [depart, arrivee, vers].
const ep = (k, champs) => ({ depart: `d${k}`, arrivee: `a${k}`, chemin: [{ de: `d${k}`, execution: `a${k}`, operation: 'f', entrees: ['e'], vers: `a${k}` }], ...champs });
const present = (champs) => ({ depart: 'dP', chemin: [{ de: 'dP', operation: 'f', entrees: ['e'] }], ...champs });
const chemins = (...noms) => noms.map((n) => ({ chemin: n.split('.'), constats: [] }));

// =============================================================================================================== A–E : vécu réel (S2 : émission ↔ réponse)
test('A. POSITIF : bonjour→merci, salut→oui ×2 ; présent salut → attente conditionnée valeurs.arrivee = oui, fondée sur la classe exacte { départ salut ↔ arrivée oui }', async () => {
  const { conditionnees, contexte } = await histoire(CANON, 'salut');
  assert.deepEqual(resume(conditionnees), [['valeurs.arrivee', CHAINE('oui')]]);
  const [a] = conditionnees;
  assert.equal(a.fondation.length, 1);
  const [f] = a.fondation;
  assert.deepEqual(f.constats.map((c) => [nom(c.chemin), c.valeur]).sort(), [['valeurs.arrivee', 'oui'], ['valeurs.depart', 'salut']]);
  assert.deepEqual(f.conditions.map((c) => [nom(c.chemin), c.type, c.valeur]), [['valeurs.depart', 'chaine', 'salut']]);
  assert.equal(f.couverture.length, 2, 'les deux épisodes salut→oui, identités [départ, arrivée, …vers]');
  assert.deepEqual(a.temoinsContexte, f.couverture); assert.deepEqual(a.unitesIssues, f.couverture);
  assert.equal(a.idContexte, contexte.id);
});

test('B. AUTRE PRÉSENT : même histoire, présent bonjour → merci (pas oui)', async () => {
  const { conditionnees } = await histoire(CANON, 'bonjour');
  assert.deepEqual(resume(conditionnees), [['valeurs.arrivee', CHAINE('merci')]]);
  assert.deepEqual(conditionnees[0].fondation[0].conditions.map((c) => c.valeur), ['bonjour']);
});

test('C. INCONNU : même histoire, présent coucou → aucune attente conditionnée (aucune classe raccordée)', async () => {
  const { conditionnees } = await histoire(CANON, 'coucou');
  assert.deepEqual(conditionnees, []);
});

test('D. CONTRADICTION : salut→oui, salut→non ; présent salut → aucun choix (ni oui ni non) ; idem avec bonjour→merci en plus', async () => {
  for (const paires of [[['salut', 'oui'], ['salut', 'non']], [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'non']]]) {
    const { conditionnees, contexte, v, E } = await histoire(paires, 'salut');
    assert.deepEqual(conditionnees, [], JSON.stringify(paires));
    // ni divergence : aucune classe ne relie « salut » à une arrivée (oui et non n'ont pas la couverture de salut)
    const [sortie] = duVecu([contexte], { id: E.id, horodatage: E.horodatage }, v.valeurs, v.executions.filter((e) => e.horodatage <= E.horodatage && e.idDesignation !== E.id), v.descriptions);
    assert.deepEqual(sortie.divergences, []);
  }
});

test('E. VALEURS NON TEXTUELLES : A17→42 (chaîne reçue) dans le vécu ; nombre 42 par le cœur pur — même mécanisme, type ET valeur exacts (42 ≠ "42")', async () => {
  const { conditionnees } = await histoire([['A17', '42'], ['B3', '7']], 'A17');
  assert.deepEqual(resume(conditionnees), [['valeurs.arrivee', CHAINE('42')]]);
  // Une histoire d'UN seul épisode A17→42 ne donne aucune classe : ses constats sont universels (R2 de .95) — rapporté, non contourné.
  assert.deepEqual((await histoire([['A17', '42']], 'A17')).conditionnees, []);
  const famille = [ep(1, { valeurs: { depart: 'A17', arrivee: 42 } }), ep(2, { valeurs: { depart: 'B3', arrivee: 7 } })];
  const r = raccordsConditionnes(famille, present({ valeurs: { depart: 'A17' } }), chemins('valeurs.arrivee', 'arrivee'));
  assert.deepEqual(r.attentes.map((a) => [nom(a.chemin), a.constat]), [['valeurs.arrivee', { type: 'nombre', valeur: 42 }]]);
  // un présent "A17" de même texte mais d'un autre type ne raccorde pas ; un présent 17 (nombre) non plus
  const familleN = [ep(1, { valeurs: { depart: 17, arrivee: 42 } }), ep(2, { valeurs: { depart: 3, arrivee: 7 } })];
  assert.deepEqual(raccordsConditionnes(familleN, present({ valeurs: { depart: '17' } }), chemins('valeurs.arrivee')).attentes, []);
  assert.deepEqual(raccordsConditionnes(familleN, present({ valeurs: { depart: 17 } }), chemins('valeurs.arrivee')).attentes.map((a) => a.constat), [{ type: 'nombre', valeur: 42 }]);
});

// =============================================================================================================== F–H : cœur pur
const F3 = [ep(1, { p: 'u', q: 'v', r: 'w' }), ep(2, { p: 'u', q: 'v', r: 'w' }), ep(3, { p: 'u3', q: 'v3', r: 'w3' }), ep(4, { p: 'u4', q: 'v4', r: 'w4' })];

test('F. PLUSIEURS MEMBRES : classe { p=u, q=v, r=w } — deux connus concordants → r = w ; un connu contredit → classe rejetée ; un seul connu → les autres ouverts sont candidats ; aucun connu → rien', () => {
  const [classe] = coCouverturesParChemins(F3).classes.filter((c) => c.couverture.length === 2);
  assert.equal(classe.constats.length, 3);
  const ouverts = chemins('p', 'q', 'r');
  const tous = raccordsConditionnes(F3, present({ p: 'u', q: 'v' }), ouverts);
  assert.deepEqual(tous.attentes.map((a) => [nom(a.chemin), a.constat.valeur, a.fondation[0].conditions.map((c) => nom(c.chemin)).sort()]), [['r', 'w', ['p', 'q']]]);
  assert.deepEqual(raccordsConditionnes(F3, present({ p: 'u', q: 'X' }), ouverts), { attentes: [], divergences: [] }, 'un membre connu contredit : rejet entier, r n’est pas engagé');
  assert.deepEqual(raccordsConditionnes(F3, present({ p: 'u', q: 'v3' }), ouverts), { attentes: [], divergences: [] }, 'connu égal à une AUTRE classe : contradiction pour les deux');
  const unSeul = raccordsConditionnes(F3, present({ p: 'u' }), ouverts);
  assert.deepEqual(unSeul.attentes.map((a) => [nom(a.chemin), a.constat.valeur]).sort(), [['q', 'v'], ['r', 'w']], 'q absent de la partie connue : ni condition ni contradiction, candidat car ouvert');
  assert.deepEqual(raccordsConditionnes(F3, present({ p: 'u' }), chemins('r')).attentes.map((a) => nom(a.chemin)), ['r'], 'q ni connu ni ouvert : ignoré');
  assert.deepEqual(raccordsConditionnes(F3, present({}), ouverts).attentes, [], 'aucun membre connu : aucun raccord');
  // un membre connu sous un autre TYPE (conteneur au lieu de la chaîne historique) contredit aussi
  assert.deepEqual(raccordsConditionnes(F3, present({ p: 'u', q: ['v'] }), ouverts).attentes, []);
});

test('G. CANDIDATS IDENTIQUES : dans une famille, un constat (chemin, valeur) n’a qu’UNE couverture, donc n’appartient qu’à UNE classe — deux classes ne peuvent pas engager le même constat ; représentation : fondation = LISTE des classes proposantes (aucune préférée) ; entre sources, une attente .74 et une conditionnée identiques coexistent (deux lignes)', async () => {
  for (const famille of [F3, [ep(1, { a: 1, b: 2, c: 3 }), ep(2, { a: 1, b: 2, c: 4 }), ep(3, { a: 5, b: 2, c: 3 }), ep(4, { a: 5, b: 6, c: 4 })]]) {
    const vus = new Map();
    for (const classe of coCouverturesParChemins(famille).classes) for (const c of classe.constats) {
      const cle = JSON.stringify([c.chemin, c.type, c.valeur]);
      assert.equal(vus.has(cle), false, `${cle} dans deux classes`); vus.set(cle, classe.couverture);
    }
  }
  const { universelles, conditionnees } = await histoire([['x', 'y'], ['salut', 'oui'], ['salut', 'oui']], 'salut');
  const u = universelles.filter((a) => nom(a.chemin) === 'valeurs.arrivee'); const c = conditionnees.filter((a) => nom(a.chemin) === 'valeurs.arrivee');
  assert.deepEqual(u.map((a) => a.constat), [CHAINE('oui')]); assert.deepEqual(c.map((a) => a.constat), [CHAINE('oui')]);
  assert.notEqual(u[0].id, c[0].id); assert.equal(Object.hasOwn(u[0], 'fondation'), false); assert.ok(Array.isArray(c[0].fondation) && c[0].fondation.length === 1);
});

test('H. CANDIDATS DIVERGENTS : deux classes raccordées proposent r = w1 et r = w2 → AUCUNE attente sur r, divergence rapportée avec ses deux fondations', () => {
  const famille = [ep(1, { p: 'u', q: 'k', r: 'w1' }), ep(2, { p: 'z', q: 'v', r: 'w2' }), ep(3, { p: 'z', q: 'k', r: 'w3' })];
  const r = raccordsConditionnes(famille, present({ p: 'u', q: 'v' }), chemins('r'));
  assert.deepEqual(r.attentes, []);
  assert.equal(r.divergences.length, 1);
  assert.deepEqual(nom(r.divergences[0].chemin), 'r');
  assert.deepEqual(r.divergences[0].propositions.map((p) => [p.constat.valeur, p.fondation[0].conditions.map((c) => `${nom(c.chemin)}=${c.valeur}`)]).sort(), [['w1', ['p=u']], ['w2', ['q=v']]]);
  // ordre des épisodes reçu sans effet (aucun premier/dernier)
  assert.deepEqual(raccordsConditionnes([...famille].reverse(), present({ p: 'u', q: 'v' }), chemins('r')).attentes, []);
  // les autres chemins non divergents restent engagés : ajout d'un chemin s porté avec w1
  const famille2 = famille.map((e, i) => ({ ...e, s: i === 0 ? 'x1' : 'y' })); // s = y couvre { 2, 3 } : hors de la seconde classe
  const r2 = raccordsConditionnes(famille2, present({ p: 'u', q: 'v' }), chemins('r', 's'));
  assert.deepEqual(r2.attentes.map((a) => [nom(a.chemin), a.constat.valeur]), [['s', 'x1']]); assert.equal(r2.divergences.length, 1);
});

// =============================================================================================================== I : temporalité
test('I. FUTUR : K0 (avant réponse) = calcul sur l’histoire antérieure seule ; K1 (après réponse « non ») : attente et fondation persistées INCHANGÉES ; un recalcul à K1 pour la même désignation exclut sa propre conséquence et redonne K0', async () => {
  const { w, E, conditionnees: k0, contexte, v: v0 } = await histoire(CANON, 'salut');
  assert.deepEqual(resume(k0), [['valeurs.arrivee', CHAINE('oui')]]);
  assert.ok(v0.executions.every((e) => e.idDesignation !== E.id), 'K0 : aucune conséquence de la désignation n’existe');
  const fige = structuredClone(k0);
  const designation = { id: E.id, horodatage: E.horodatage };
  const sans = (l) => l.map(({ id, horodatage, idObservation, ...reste }) => reste);
  assert.deepEqual(duVecu([contexte], designation, v0.valeurs, v0.executions, v0.descriptions)[0].attentes, sans(k0), 'persisté = calcul pur sur le vécu avant');
  await w.tour('non', E.id); await w.tick(3); await w.emettre('salut');
  const k1 = (await w.magasin.lireTout('attentesProspectives')).filter((a) => a.idContexte === contexte.id && Object.hasOwn(a, 'fondation'));
  assert.deepEqual(k1, fige, 'K1 : rien n’est réécrit');
  const v1 = await lireExecutionsVecues(w.magasin);
  const reponse = v1.executions.filter((e) => e.idDesignation === E.id);
  assert.ok(reponse.length >= 1, 'K1 : la réponse réelle existe');
  assert.deepEqual(duVecu([contexte], designation, v1.valeurs, v1.executions, v1.descriptions)[0].attentes, sans(k0), 'filtre temporel : sa propre issue n’entre jamais dans sa classe');
  // preuve que le filtre est porteur : la famille NON filtrée de K1 contient salut→non, et la classe salut ↔ oui n'y est plus exacte
  const familleK1 = famillesDEpisodes(episodesDeTransformation(v1.valeurs, v1.executions, v1.descriptions)).familles.find((f) => vue(f.structure) === S2);
  assert.ok(familleK1.episodes.some((e) => e.chemin.some((s) => reponse.some((r) => r.id === s.execution))));
  const partie = { depart: contexte.episodePartiel.depart, chemin: contexte.episodePartiel.chemin, valeurs: { depart: 'salut' } };
  assert.deepEqual(raccordsConditionnes(familleK1.episodes, partie, contexte.chemins).attentes.filter((a) => nom(a.chemin) === 'valeurs.arrivee'), []);
  // et une désignation dont l'instant précède toute l'histoire ne voit rien
  assert.deepEqual(duVecu([contexte], { id: E.id, horodatage: '2000-01-01T00:00:00.000Z' }, v1.valeurs, v1.executions, v1.descriptions)[0].attentes, []);
});

// =============================================================================================================== J : issue
test('J. ISSUE par le mécanisme existant : réponse conforme (oui) → realisee ; réponse différente (non) → autre, réel non ; la fondation est recopiée dans l’issue', async () => {
  for (const [reponse, statut] of [['oui', 'realisee'], ['non', 'autre']]) {
    const { w, E, conditionnees, contexte } = await histoire(CANON, 'salut');
    await w.tour(reponse, E.id); await w.tick(1);
    const v = await lireExecutionsVecues(w.magasin);
    const [a] = conditionnees;
    const issues = issuesDeLAttenteProspective(a, contexte, v.valeurs, v.executions, v.descriptions);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].statut, statut, reponse);
    assert.deepEqual(issues[0].reel, CHAINE(reponse));
    assert.deepEqual(issues[0].fondation, a.fondation);
    assert.deepEqual(issues[0].constat, CHAINE('oui'));
  }
});

// =============================================================================================================== persistance, API, gardes
test('PERSISTANCE : `fondation` est la seule clé optionnelle ; tableau non vide de { couverture, constats, conditions } ; une ligne sans fondation reste exactement celle d’avant', async () => {
  const magasin = magasinMemoireVive();
  const designation = { id: 'des-1', idObservation: 'obs-1' }; const contexte = { id: 'ctx-1', idDesignation: 'des-1' };
  const base = { idContexte: 'ctx-1', idDesignation: 'des-1', structure: [{ operation: 'f', entrees: ['e'] }], chemin: ['r'], constat: CHAINE('w'), temoinsContexte: [['d1', 'a1', 'a1']], unitesIssues: [['d1', 'a1', 'a1']] };
  const bonne = [{ couverture: [['d1', 'a1', 'a1']], constats: [{ chemin: ['p'], type: 'chaine', valeur: 'u' }, { chemin: ['r'], type: 'chaine', valeur: 'w' }], conditions: [{ chemin: ['p'], type: 'chaine', valeur: 'u' }] }];
  for (const mauvaise of [[], {}, 'x', [{ couverture: [], constats: bonne[0].constats, conditions: bonne[0].conditions }], [{ ...bonne[0], conditions: [] }], [{ ...bonne[0], constats: [bonne[0].constats[0]] }], [{ ...bonne[0], score: 1 }]]) {
    await assert.rejects(enregistrerAttenteProspective(magasin, { designation, contexte, attente: { ...base, fondation: mauvaise } }), TypeError, JSON.stringify(mauvaise));
  }
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation, contexte, attente: { ...base, source: 'x' } }), TypeError);
  const sans = await enregistrerAttenteProspective(magasin, { designation, contexte, attente: base });
  assert.equal(Object.hasOwn(sans, 'fondation'), false);
  const avec = await enregistrerAttenteProspective(magasin, { designation, contexte, attente: { ...base, fondation: bonne } });
  assert.deepEqual(avec.fondation, bonne); assert.notEqual(avec.fondation, bonne, 'copie');
});

test('API : entrées mal formées → TypeError ; entrées jamais modifiées ; vue transmise explicitement (aucun recalcul sans chemins)', async () => {
  const refuse = (f) => assert.throws(f, TypeError);
  refuse(() => raccordsConditionnes('x', {}, [])); refuse(() => raccordsConditionnes([], null, [])); refuse(() => raccordsConditionnes([], {}, [{}]));
  const { E, contexte, v } = await histoire(CANON, 'salut');
  const d = { id: E.id, horodatage: E.horodatage };
  refuse(() => attentesConditionneesDesContextes([contexte], d, v.valeurs, v.executions, v.descriptions, null));
  refuse(() => attentesConditionneesDesContextes([contexte], { id: 'autre', horodatage: E.horodatage }, v.valeurs, v.executions, v.descriptions, { episodes: [] }));
  const gele = structuredClone(F3);
  raccordsConditionnes(F3, present({ p: 'u' }), chemins('q', 'r'));
  assert.deepEqual(F3, gele);
  // sans vue (épisodes vides) : aucune classe, aucune attente — la vue n'est jamais recalculée en interne
  assert.deepEqual(attentesConditionneesDesContextes([contexte], d, v.valeurs, v.executions, v.descriptions, { episodes: [] })[0].attentes, []);
  assert.deepEqual(duVecu([{ ...contexte, chemins: [] }], d, v.valeurs, v.executions, v.descriptions), [{ idContexte: contexte.id, attentes: [], divergences: [] }]);
});

test('GARDES : pur ; aucun cache, WeakMap, état de module ; aucun nom de champ, d’opération ni de valeur ; aucune probabilité, fréquence, confiance, score, préférence ; n’importe aucun mécanisme d’action', () => {
  const SRC = readFileSync(join(RACINE, 'app', 'langage', 'attentes-conditionnees.js'), 'utf8');
  const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const importes = [...CODE.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importes, ['./co-couvertures.js', './constats-par-chemin.js', './constats-structurels.js', './contexte-prospectif.js', './couverture-occurrences.js', './episodes-de-transformation.js', './familles-episodes.js', './identite-episode.js', './parcours-structure.js', './reconstruction-structure.js', './restriction-parcours.js']); // MISE À JOUR DÉLIBÉRÉE v0.64.5 (relation fondatrice structurée) : premier branchement réel des primitives structurelles (relation calculée à K0)
  assert.equal(/WeakMap|WeakRef|globalThis|\bcache\b|Math\.|Date|random|\bawait\b|\basync\b|lireTout|ecrire/.test(CODE), false);
  assert.deepEqual(CODE.split('\n').filter((l) => /^(let|var) /.test(l)), [], 'aucune variable de module');
  assert.equal(/'(valeurs|arrivee|depart|relationValeur|reel|salut|oui|chaine|nombre)'|\.valeurs\b|\.arrivee\b|\.relationValeur\b/.test(CODE), false, 'aucun nom de champ d’épisode ni de valeur');
  assert.equal(/probab|frequen|fréquen|confian|score|prefer|préfér|majorit|vote|poids|hasard|besoin|strategi|moyen|capacite|initiative|rotation/i.test(CODE), false);
  // seuls les quatre sites des attentes .74 appellent ce calcul ; rien ne lit `fondation` pour décider
  const appelants = ['capacite', 'environnement-conversation', 'execution-sollicitee', 'prospection-soi'];
  for (const f of ['besoins', 'episode-propre', 'tick-propre', 'execution-mecanique', 'applications-sollicitables', 'relation']) {
    const s = readFileSync(join(RACINE, 'app', 'langage', `${f}.js`), 'utf8');
    assert.equal(/attentes-conditionnees|attentesConditionnees|fondation/.test(s), false, f);
  }
  for (const f of appelants) assert.ok(readFileSync(join(RACINE, 'app', 'langage', `${f}.js`), 'utf8').includes("from './attentes-conditionnees.js'"), f);
  // .74 inchangé : aucune référence à la nouvelle source
  assert.equal(/conditionn|coCouvertures|fondation/.test(readFileSync(join(RACINE, 'app', 'langage', 'attentes-prospectives.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), false);
});

// =============================================================================================================== v0.64.1 — vue transmise (performance)
// MISE À JOUR v0.64.1 (décision ChatGPT « v0.64.1 NON AUTORISÉE AU DÉPÔT POUR L'INSTANT », 13/10/2026) : la vue des épisodes n'est plus recalculée pour les
// attentes conditionnées ; chaque site la calcule UNE fois sur le vécu « avant » et la transmet aux contextes ET aux attentes conditionnées.
test('VUE TRANSMISE (preuve statique) : dans chacun des quatre sites, UNE vue, calculée sur exactement les trois lignes passées à contextesProspectifs, transmise telle quelle aux contextes et aux attentes conditionnées ; aucun autre calcul de vue', () => {
  for (const site of ['capacite', 'environnement-conversation', 'execution-sollicitee', 'prospection-soi']) {
    const code = readFileSync(join(RACINE, 'app', 'langage', `${site}.js`), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.deepEqual(code.match(/episodesDeTransformation\(([^)]*)\)/g), ['episodesDeTransformation(vecu.valeurs, vecu.executions, vecu.descriptions)'], site);
    assert.equal((code.match(/contextesProspectifs\(application, vecu\.valeurs, vecu\.executions, vecu\.descriptions, vueEpisodes\)/g) || []).length, 1, site);
    assert.equal((code.match(/(?<!let )vueEpisodes = /g) || []).length, 1, `${site} : une seule affectation de la vue`);
    assert.ok(/attentesConditionneesDesContextes\(\w+, \w+, [\w.]+, [\w.]+, vecu\.descriptions, vueEpisodes\)/.test(code), site);
    assert.ok(code.indexOf('vueEpisodes = episodesDeTransformation(') < code.indexOf('contextesProspectifs(application'), site);
    assert.equal(/vecu\s*=/.test(code.slice(code.indexOf('vueEpisodes = episodesDeTransformation('))), false, `${site} : le vécu n'est jamais relu après la vue`);
  }
  // execution-sollicitee : les lignes passées aux attentes sont les mêmes références que celles de la vue
  const es = readFileSync(join(RACINE, 'app', 'langage', 'execution-sollicitee.js'), 'utf8');
  assert.ok(es.includes('const valeursAvant = vecu.valeurs;') && es.includes('const executionsAvant = vecu.executions;'));
  const ac = readFileSync(join(RACINE, 'app', 'langage', 'attentes-conditionnees.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/episodesDeTransformation\(/.test(ac), false, 'le calcul conditionné ne calcule jamais de vue');
});

test('VUE TRANSMISE (compteur de harnais) : attentesConditionneesDesContextes ne lit lignesValeurs que pour la partie connue de chaque contexte — aucun calcul de vue ; la vue n’est jamais modifiée (gelée en profondeur) ; même sortie que la vue recalculée', async () => {
  const { E, v, w } = await histoire(CANON, 'salut');
  const contextes = (await w.magasin.lireTout('contextesProspectifs')).filter((c) => c.idDesignation === E.id);
  const d = { id: E.id, horodatage: E.horodatage };
  const compteur = { n: 0 }; const espion = (t) => new Proxy(t, { get(o, k, r) { if (k === 'length') compteur.n += 1; return Reflect.get(o, k, r); } });
  const geler = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(geler); Object.freeze(o); } return o; };
  const vueGelee = geler(episodesDeTransformation(v.valeurs, v.executions, v.descriptions));
  compteur.n = 0; episodesDeTransformation(espion(v.valeurs), v.executions, v.descriptions); const parVue = compteur.n;
  compteur.n = 0; for (const c of contextes.filter((x) => x.chemins.length > 0)) partieConnueEpisode(c.episodePartiel, espion(v.valeurs), v.executions, v.descriptions); const parParties = compteur.n;
  assert.ok(parVue > 0, 'étalon : un calcul de vue lit lignesValeurs (lectures additives)');
  compteur.n = 0;
  const sortie = attentesConditionneesDesContextes(contextes, d, espion(v.valeurs), v.executions, v.descriptions, vueGelee);
  assert.equal(compteur.n, parParties, 'aucune vue calculée : seules les parties connues lisent les valeurs');
  assert.deepEqual(sortie, duVecu(contextes, d, v.valeurs, v.executions, v.descriptions));
  assert.ok(sortie.some((s) => s.attentes.length > 0));
});
