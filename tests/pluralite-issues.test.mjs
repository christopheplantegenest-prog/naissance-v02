// v0.63.96 — PLURALITÉ DES ISSUES (décision ChatGPT « AUTORISATION DE CODER v0.63.96 », 12/10/2026 ; sonde « deux réponses à une même émission »).
// Une émission peut avoir plusieurs conséquences autonomes (réceptions déclarées) : chaque conséquence est une issue indépendante et immuable ;
// unité d'issue uniforme [idContexte, idExecution, …chemin] ; filtre temporel de .74 appliqué à chaque issue ; anciennes attentes (.95) intactes.
// Preuves A–L sur le moteur réel (harnais du flux de vie, Répondre compris) + régression du défaut .95 (extinction des attentes) + gardes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { issueDuContexteProspectif, issuesDuContexteProspectif } from '../app/langage/issue-contexte-prospectif.js';
import { issueDeLAttenteProspective, issuesDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES } from '../app/langage/connaissances.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { moyensParStrategie, BESOIN_RELATION } from '../app/langage/besoins.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const sansCommentaires = (src) => src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError);
const S2 = 'symbolesDeChaine(chaine)>environnement:conversation(emis)';
const S1 = 'environnement:conversation(emis)';
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');

// ------------------------------------------------------------------------------------------------------------------------------- harnais réel
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
    let reception = null;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); reception = d.reception; await consequenceReception(magasin, reception); }
    for (const ev of [s.observation.id, reception ? reception.id : null].filter(Boolean)) await traiterOccasion(magasin, ev);
    return { s, reception };
  }
  async function emettre(texte) {
    const { s } = await tour(texte);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).filter((m) => m.idObservation === s.observation.id).find((m) => ex.find((q) => q.id === m.idExecution).operation === 'symbolesDeChaine');
  }
  const repondre = async (texte, E) => (await tour(texte, E.id)).reception;
  async function tick(k = 1) { for (let i = 0; i < k; i += 1) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  const vecu = () => lireExecutionsVecues(magasin);
  const contexte = async (E, structure) => (await magasin.lireTout('contextesProspectifs')).find((c) => c.idDesignation === E.id && vue(c.structure) === structure);
  const attentes = async (E, structure, chemin) => (await magasin.lireTout('attentesProspectives')).filter((a) => a.idDesignation === E.id && vue(a.structure) === structure && (chemin === undefined || a.chemin.join('.') === chemin));
  return { magasin, tour, emettre, repondre, tick, vecu, contexte, attentes };
}
// Un vécu de départ : x→y (le premier échange n'a pas d'histoire), puis salut→oui (une unité « oui »), puis l'émission E de « salut ».
async function prepare() {
  const w = monde();
  const E0 = await w.emettre('x'); await w.repondre('y', E0); await w.tick(2);
  const E1 = await w.emettre('salut'); await w.repondre('oui', E1); await w.tick(2);
  const E = await w.emettre('salut');
  return { w, E };
}
const parExecution = (liste) => new Map(liste.map((i) => [i.issue.idExecution, i]));

// ------------------------------------------------------------------------------------------------------------------------------- A–D, F
test('A. aucune conséquence : issues [] ; le singulier rend issue null (contrat historique)', async () => {
  const { w, E } = await prepare();
  const c = await w.contexte(E, S2); const v = await w.vecu();
  assert.deepEqual(issuesDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions), []);
  assert.equal(issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions).issue, null);
  const [a] = await w.attentes(E, S2, 'valeurs.arrivee');
  assert.deepEqual(issuesDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions), []);
  assert.equal(issueDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions).issue, null);
});

test('B. une conséquence : UNE issue, identique au singulier historique ; l’ancre donne la même chose', async () => {
  const { w, E } = await prepare();
  const R = await w.repondre('oui', E);
  const c = await w.contexte(E, S2); const v = await w.vecu();
  const seul = issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions);
  const liste = issuesDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions);
  assert.equal(liste.length, 1);
  assert.deepEqual(liste[0], seul);
  assert.deepEqual(issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions, R.id), seul);
  assert.equal(seul.issue.idExecution, R.id);
  const [a] = await w.attentes(E, S2, 'valeurs.arrivee');
  assert.deepEqual(issuesDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions), [issueDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions)]);
});

test('C. deux conséquences différentes : deux issues indépendantes ; le singulier sans ancre garde son TypeError ; ancres exactes', async () => {
  const { w, E } = await prepare();
  const R1 = await w.repondre('oui', E); const R2 = await w.repondre('non', E);
  const c = await w.contexte(E, S2); const v = await w.vecu();
  refuse(() => issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions));
  const issues = parExecution(issuesDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions));
  assert.deepEqual([...issues.keys()].sort(), [R1.id, R2.id].sort());
  assert.equal(issues.get(R1.id).issue.episode.valeurs.arrivee, 'oui');
  assert.equal(issues.get(R2.id).issue.episode.valeurs.arrivee, 'non');
  for (const R of [R1, R2]) assert.deepEqual(issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions, R.id), issues.get(R.id));
  refuse(() => issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions, 'reception-inconnue'));
  const autre = v.executions.find((x) => x.idDesignation !== c.idDesignation);
  refuse(() => issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions, autre.id));
});

test('D. deux conséquences de même valeur, identités différentes : deux issues, même constat', async () => {
  const { w, E } = await prepare();
  const R1 = await w.repondre('oui', E); const R2 = await w.repondre('oui', E);
  const c = await w.contexte(E, S2); const v = await w.vecu();
  const issues = issuesDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions);
  assert.deepEqual(issues.map((i) => i.issue.idExecution).sort(), [R1.id, R2.id].sort());
  assert.deepEqual(issues.map((i) => i.issue.episode.valeurs.arrivee), ['oui', 'oui']);
});

test('F. deux contextes aboutissant à une même exécution : clés (contexte, exécution) distinctes', async () => {
  const { w, E } = await prepare();
  const R = await w.repondre('oui', E);
  const v = await w.vecu();
  const cs = (await w.magasin.lireTout('contextesProspectifs')).filter((c) => c.idDesignation === E.id);
  assert.deepEqual(cs.map((c) => vue(c.structure)).sort(), [S1, S2]);
  const cles = cs.flatMap((c) => issuesDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions).map((i) => `${i.idContexte}|${i.issue.idExecution}`));
  assert.equal(cles.length, 2); assert.equal(new Set(cles).size, 2);
  for (const k of cles) assert.equal(k.endsWith(`|${R.id}`), true);
});

// ------------------------------------------------------------------------------------------------------------------------------- G, H, I
test('G. attente arrivee="oui" ; R1 oui, R2 non : réalisée (R1) ET autre (R2, réel non), chacune seule', async () => {
  const { w, E } = await prepare();
  const [a] = await w.attentes(E, S2, 'valeurs.arrivee');
  assert.deepEqual(a.constat, { type: 'chaine', valeur: 'oui' });
  const R1 = await w.repondre('oui', E); const R2 = await w.repondre('non', E);
  const c = await w.contexte(E, S2); const v = await w.vecu();
  const issues = new Map(issuesDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions).map((i) => [i.issue.idExecution, i]));
  assert.equal(issues.get(R1.id).statut, 'realisee');
  assert.equal(issues.get(R2.id).statut, 'autre'); assert.deepEqual(issues.get(R2.id).reel, { type: 'chaine', valeur: 'non' });
  for (const R of [R1, R2]) assert.deepEqual(issueDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions, R.id), issues.get(R.id));
  refuse(() => issueDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions));
});

test('H / I. .74 après une double réponse : divergentes → aucun universel ; identiques → universel « oui » sur deux unités distinctes', async () => {
  for (const [r1, r2, attendu] of [['oui', 'non', null], ['oui', 'oui', 'oui']]) {
    const { w, E } = await prepare();
    const R1 = await w.repondre(r1, E); const R2 = await w.repondre(r2, E); await w.tick(2);
    const cE = await w.contexte(E, S2);
    const E2 = await w.emettre('salut');
    const arr = await w.attentes(E2, S2, 'valeurs.arrivee');
    if (attendu === null) { assert.deepEqual(arr, [], `${r1}/${r2}`); continue; }
    assert.equal(arr.length, 1); assert.deepEqual(arr[0].constat, { type: 'chaine', valeur: 'oui' });
    const deE = arr[0].unitesIssues.filter((u) => u[0] === cE.id);
    assert.deepEqual(deE.map((u) => u[1]).sort(), [R1.id, R2.id].sort());
    for (const u of deE) assert.deepEqual(u.slice(2), ['valeurs', 'arrivee']);
  }
});

// ------------------------------------------------------------------------------------------------------------------------------- E (temps)
test('E. R1, attentes X, plusieurs tours, R2 tardive, attentes Y : X figées et sans R2 (même recalculées), U1 identique, Y voit R1 et R2', async () => {
  const { w, E } = await prepare();
  const cE = await w.contexte(E, S2);
  const R1 = await w.repondre('oui', E); await w.tick(2);
  const E2 = await w.emettre('salut');
  const X = await w.attentes(E2, S2);
  const Xfige = structuredClone(X);
  const U1 = X.flatMap((a) => a.unitesIssues).find((u) => u[0] === cE.id && u[1] === R1.id && u.slice(2).join('.') === 'valeurs.arrivee');
  assert.ok(U1, 'U1 = [C_E, R1, …chemin]');
  await w.tick(2); await w.tour('bonjour'); await w.tick(2);
  const R2 = await w.repondre('oui', E); await w.tick(2);
  // X persistées : strictement inchangées ; et recalculées sur le magasin POSTÉRIEUR, toujours sans R2 (filtre temporel par issue).
  assert.deepEqual(await w.attentes(E2, S2), Xfige);
  assert.equal(JSON.stringify(Xfige).includes(R2.id), false);
  const v = await w.vecu();
  const c2 = await w.contexte(E2, S2);
  const designation = { id: E2.id, horodatage: E2.horodatage };
  const recalcul = attentesDuContexteProspectif(c2, designation, await w.magasin.lireTout('contextesProspectifs'), v.valeurs, v.executions, v.descriptions);
  assert.equal(JSON.stringify(recalcul).includes(R2.id), false, 'R2 jamais rétroactive');
  // Y
  const E3 = await w.emettre('salut');
  const Y = await w.attentes(E3, S2, 'valeurs.arrivee');
  const unitesY = Y.flatMap((a) => a.unitesIssues);
  assert.ok(unitesY.some((u) => JSON.stringify(u) === JSON.stringify(U1)), 'U1 strictement identique dans Y');
  assert.ok(unitesY.some((u) => u[0] === cE.id && u[1] === R2.id), 'Y voit R2');
});

// ------------------------------------------------------------------------------------------------------------------------------- J, K
test('J. redémarrage (JSON, lignes inversées) : mêmes issues, mêmes unités recalculées', async () => {
  const { w, E } = await prepare();
  await w.repondre('oui', E); await w.repondre('non', E);
  const c = await w.contexte(E, S2); const v = await w.vecu();
  const avant = issuesDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions);
  const donnees = {}; for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t))).reverse();
  const neuf = magasinMemoireVive(); await neuf.remplacerTout(donnees);
  const v2 = await lireExecutionsVecues(neuf);
  const c2 = (await neuf.lireTout('contextesProspectifs')).find((x) => x.id === c.id);
  assert.deepEqual(issuesDuContexteProspectif(c2, v2.valeurs, v2.executions, v2.descriptions), avant);
});

test('K. attente au format .95 ([idContexte, …chemin]) relue par .96 : lisible, recopiée intacte, même issue, jamais migrée', async () => {
  const { w, E } = await prepare();
  const [a] = await w.attentes(E, S2, 'valeurs.arrivee');
  const ancienne = { ...structuredClone(a), unitesIssues: a.unitesIssues.map((u) => [u[0], ...u.slice(2)]) };
  await w.magasin.ecrire('attentesProspectives', ancienne);
  await w.repondre('oui', E); await w.tick(2); await w.emettre('salut');
  const relue = (await w.magasin.lireTout('attentesProspectives')).find((x) => x.id === a.id);
  assert.deepEqual(relue, ancienne, 'aucune migration silencieuse');
  const c = await w.contexte(E, S2); const v = await w.vecu();
  const issueAncienne = issueDeLAttenteProspective(relue, c, v.valeurs, v.executions, v.descriptions);
  const issueNouvelle = issueDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions);
  assert.deepEqual(issueAncienne.unitesIssues, ancienne.unitesIssues);
  assert.deepEqual({ ...issueAncienne, unitesIssues: null }, { ...issueNouvelle, unitesIssues: null });
  assert.equal(issueAncienne.statut, 'realisee');
  assert.deepEqual(issuesDeLAttenteProspective(relue, c, v.valeurs, v.executions, v.descriptions), [issueAncienne]);
});

// ------------------------------------------------------------------------------------------------------------------------------- L, régression
test('L. B2 : la seconde réponse ne crée aucune preuve (r déjà à 0) ; moyens et stratégies ne voient que R1', async () => {
  const { w, E } = await prepare();
  const R1 = await w.repondre('oui', E); const R2 = await w.repondre('oui', E);
  const v = await w.vecu();
  const preuves = moyensParStrategie(v, BESOIN_RELATION).strategies.flatMap((s) => s.preuves);
  assert.equal(preuves.some((p) => p.reception === R2.id), false);
  const variations = (await w.magasin.lireTout('variationsRelation')).filter((x) => x.cause.id === R2.id);
  assert.equal(variations.length, 1); assert.equal(variations[0].valeur, 0);
  assert.equal(R1.id !== R2.id, true);
});

test('RÉGRESSION .95 : après une double réponse, les attentes des émissions suivantes continuent d’être produites', async () => {
  const compte = async (double) => {
    const w = monde();
    const E0 = await w.emettre('x'); await w.repondre('y', E0); await w.tick(2);
    const E = await w.emettre('salut'); await w.repondre('oui', E); if (double) await w.repondre('oui', E);
    const borne = (await w.magasin.lireTout('emissions')).length;
    await w.tick(4);
    const ids = new Set((await w.magasin.lireTout('emissions')).slice(borne).map((e) => e.id));
    const at = (await w.magasin.lireTout('attentesProspectives')).filter((a) => ids.has(a.idDesignation));
    return { emissions: ids.size, attentes: at.length, valeurs: at.filter((a) => a.chemin[0] === 'valeurs').map((a) => `${a.chemin.join('.')}=${a.constat.valeur ?? a.constat.type}`).sort() };
  };
  const simple = await compte(false); const double = await compte(true);
  assert.ok(simple.emissions > 0 && simple.attentes > 0, 'des émissions suivent (initiatives B2)');
  assert.equal(double.emissions, simple.emissions);
  assert.ok(double.attentes > 0, 'en .95 : 0');
  assert.deepEqual(double.valeurs, simple.valeurs, 'mêmes attentes de valeurs ; seules les attentes d’identité de réception cessent d’être universelles');
});

// ------------------------------------------------------------------------------------------------------------------------------- gardes
test('G1. gardes : aucun choix par ordre ni horodatage dans les issues ; .74 n’utilise l’horodatage que dans son filtre existant ; aucun import nouveau', () => {
  const lire = (n) => sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', `${n}.js`), 'utf8'));
  const ic = lire('issue-contexte-prospectif'); const ia = lire('issue-attente-prospective'); const ap = lire('attentes-prospectives');
  for (const src of [ic, ia]) { assert.equal(/horodatage|Date|premi|derni|\[0\]\.issue|\.at\(-1\)/.test(src), false); }
  assert.equal((ap.match(/horodatage/g) || []).length, 4, 'designation.horodatage (instant) + le filtre existant, appliqué à chaque exécution (présence et comparaison)');
  const imports = (src) => [...src.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports(ic), ['./constats-structurels.js', './couverture-occurrences.js', './episodes-de-transformation.js', './parcours-structure.js']);
  assert.deepEqual(imports(ia), ['./constats-structurels.js', './couverture-occurrences.js', './issue-contexte-prospectif.js']);
  assert.deepEqual(imports(ap), ['./constats-par-chemin.js', './constats-structurels.js', './contexte-prospectif.js', './couverture-occurrences.js', './episodes-de-transformation.js', './issue-contexte-prospectif.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.98 (réutilisation de la vue des épisodes) : .74 calcule une fois la vue de son vécu et la transmet aux issues // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : attentes-prospectives.js importe cheminsOuverts (règle structurelle extraite de contextesProspectifs) et partieConnueEpisode
  for (const src of [ic, ia, ap]) assert.equal(/besoins|strategi|moyensConnus|coCouvertures|initiative/.test(src), false);
});
