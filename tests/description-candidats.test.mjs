// EXPÉRIENCE D'AUTONOMIE 01 (base v0.63.76) — decrireCandidats : décrire chaque application candidate d'un tour par l'expérience, avant tout choix.
// Preuves : vue pure dormante, composition seule ; toutes les combinaisons décrites, aucune écartée ni ordonnée ; attentes possibles et historiques (couvertures, éléments
// prêts pour constatsParChemin) ; cohérence avec applicationsSollicitables (déterminées) ; scénario réel et sonde : l'étendue du choix et ce que l'expérience en dit
// (le verrou mesuré) ; pureté ; dormance ; comportement vivant inchangé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/description-candidats.js';
import { decrireCandidats } from '../app/langage/description-candidats.js';
import { applicationsSollicitables, classerCombinaisons } from '../app/langage/applications-sollicitables.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { memesCouvertures } from '../app/langage/couverture-occurrences.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'description-candidats.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^decrireCandidats : /.test(e.message));
const lien = (entree, donnee) => ({ entree, donnee });
const au = (cpc, chemin) => cpc.chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');

let compteurIds = 0;
async function rejouer(scenario, solliciter = false) {
  const magasin = magasinMemoireVive();
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const ex2 = () => magasin.lireTout('executionsOperations');
  const photo = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), contextes: await magasin.lireTout('contextesProspectifs'), attentes: await magasin.lireTout('attentesProspectives') });
  const tours = [];
  for (const t of scenario) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }));
    const res = await traiterTourAvecEnonce(t, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    const passe = await photo(); // le passé tel qu'il existe après les automatiques du tour, avant toute sollicitation
    const sollicitees = [];
    if (solliciter) {
      const { observation, univers } = s; const vals = await magasin.lireTout('valeursDonnees'); const msgId = vals[vals.length - 1].id; const faits = await ex2();
      const soll = async (operation, liaisons) => { const r = await executerApplicationSollicitee({ observation, application: { operation, liaisons }, univers }, { magasin, table: TABLE_OPERATIONS }); assert.equal(r.statut, 'executee'); sollicitees.push({ operation, liaisons }); };
      for (const R of faits.filter((e) => e.operation === 'symbolesDeChaine')) if (!faits.some((e) => e.operation === 'composerCollection' && e.liaisons[0].donnee === R.id) && observation.donneesExaminees.includes(R.id)) await soll('composerCollection', [lien('elements', R.id)]);
      if (!(await ex2()).some((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === msgId)) await soll('symbolesDeChaine', [lien('chaine', msgId)]);
    }
    tours.push({ texte: t, s, passe, sollicitees, apres: await photo() });
  }
  return { tours, magasin };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const SONDE = ['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'];
const nbCombinaisons = (d) => d.choix.reduce((s, c) => s + c.combinaisons.length, 0);
const cas = (h) => { if (h.experiences.length === 0) return 'H4'; const st = au(constatsParChemin(h.elements), ['apres', 'statut']).constats.map((c) => c.valeur); return st.length > 1 ? 'H3' : st[0] === 'realisee' ? 'H1' : st[0] === 'autre' ? 'H2' : 'Habsente'; };
const resumer = (description) => ({ contextes: description.contextes.length, ouverts: description.contextes.reduce((s, c) => s + c.chemins.length, 0), attentes: description.attentes.length, ...description.historiques.reduce((acc, h) => { acc[cas(h)] += 1; return acc; }, { H1: 0, H2: 0, H3: 0, H4: 0, Habsente: 0 }) });

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. export unique decrireCandidats ; imports = composition seule ; aucune préférence, aucun tri de mérite, aucun nom métier, aucune horloge ; aucune table', () => {
  assert.deepEqual(Object.keys(module), ['decrireCandidats']);
  assert.equal(decrireCandidats.length, 4);
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./applications-sollicitables.js', './attentes-prospectives.js', './constats-structurels.js', './contexte-prospectif.js', './couverture-occurrences.js', './experiences-attentes.js', './groupes-candidats.js']);
  assert.equal(/prefer|préfér|score|confiance|recompense|récompense|reussite|réussite|echec|échec|meilleur|pire|seuil|majorit|probab|\.sort\(|Math\.|\bDate\b|\bawait\b|\basync\b|magasin|\.ecrire|\.lireTout/i.test(CODE), false);
  assert.equal(/relationValeur|egale|differente|arrivee|'vers'|symbolesDeChaine|composerCollection|elementsObservables|'realisee'|'autre'|'absente'/.test(CODE), false);
  assert.equal(VERSION_BASE, 21); assert.equal(SCHEMA_SAUVEGARDE, 11); assert.equal(TABLES.length, 24);
});

test('A2. COHÉRENCE : les déterminées sont EXACTEMENT les applications de applicationsSollicitables ; les opérations à choisir et leur nombre de combinaisons sont ceux de classerCombinaisons ; aucune combinaison écartée', async () => {
  const { tours } = await rejouer(SCENARIO.slice(0, 4));
  for (const t of tours) {
    const d = decrireCandidats(t.s.observation, t.s.univers, t.passe, DESCRIPTIONS_OPERATIONS);
    const ref = applicationsSollicitables(t.s.observation, DESCRIPTIONS_OPERATIONS, t.s.univers);
    assert.deepEqual(d.determinees.map((x) => x.application), ref.applications);
    assert.deepEqual(d.choix.map((c) => c.operation), ref.choixAFaire);
    for (const classe of classerCombinaisons(t.s.observation, DESCRIPTIONS_OPERATIONS, t.s.univers)) {
      const c = d.choix.find((x) => x.operation === classe.operation);
      if (c === undefined) continue;
      assert.equal(c.combinaisons.length, classe.valides === null ? classe.brutes : classe.valides.length);
      assert.equal(new Set(c.combinaisons.map((x) => JSON.stringify(x.application.liaisons))).size, c.combinaisons.length, 'combinaisons toutes distinctes');
      for (const x of c.combinaisons) { assert.equal(x.application.operation, classe.operation); assert.deepEqual(Object.keys(x.description), ['contextes', 'attentes', 'historiques']); }
    }
  }
});

test('A3. DESCRIPTION : contextes = contextesProspectifs ; attentes possibles = ce que .74 écrirait maintenant (désignation fictive, jamais écrite) ; historiques par (contexte, chemin ouvert, constat) avec couverture et éléments prêts pour constatsParChemin', async () => {
  const { tours } = await rejouer(SONDE, true);
  const t = tours[5]; // T6 : la structure centrale a déjà deux issues d'attente
  const d = decrireCandidats(t.s.observation, t.s.univers, t.passe, DESCRIPTIONS_OPERATIONS);
  const sdc = d.choix.find((c) => c.operation === 'symbolesDeChaine');
  const choisie = t.sollicitees.find((s) => s.operation === 'symbolesDeChaine');
  const cand = sdc.combinaisons.find((x) => JSON.stringify(x.application.liaisons) === JSON.stringify(choisie.liaisons));
  assert.ok(cand, 'la combinaison que l\'extérieur a sollicitée est décrite comme les autres');
  assert.equal(cand.description.contextes.length, 1, 'message neuf : une projection directe');
  // les attentes possibles : exactement celles que .74 a RÉELLEMENT écrites ensuite pour cette désignation (mêmes chemin, constat, témoins, unités)
  const execution = t.apres.executions.find((e) => e.operation === 'symbolesDeChaine' && JSON.stringify(e.liaisons) === JSON.stringify(choisie.liaisons));
  const miennes = t.apres.attentes.filter((a) => a.idDesignation === execution.idDesignation);
  const sansId = (a) => ({ chemin: a.chemin, constat: a.constat, temoinsContexte: a.temoinsContexte, unitesIssues: a.unitesIssues, structure: a.structure });
  assert.deepEqual(cand.description.attentes.map(sansId), miennes.map(sansId));
  // historiques : un par (contexte, chemin ouvert, constat historique) ; couverture = identités d'attentes passées ; éléments lisibles
  const ouverts = cand.description.contextes.reduce((s, c) => s + c.chemins.reduce((k, ch) => k + ch.constats.length, 0), 0);
  assert.equal(cand.description.historiques.length, ouverts);
  for (const h of cand.description.historiques) {
    assert.deepEqual(Object.keys(h), ['rangContexte', 'chemin', 'constat', 'experiences', 'elements']);
    assert.equal(h.elements.length, h.experiences.length);
    if (h.elements.length > 0) { const cpc = constatsParChemin(h.elements); assert.deepEqual(cpc.universelle, h.experiences); assert.ok(au(cpc, ['apres', 'statut'])); }
  }
  const rel = cand.description.historiques.find((h) => h.chemin.join('.') === 'relationValeur' && h.constat.valeur === 'non_comparable');
  assert.ok(rel && rel.experiences.length >= 1);
  assert.equal(cas(rel), 'H1');
});
test('A4. PURETÉ : entrées gelées intactes ; deux appels -> résultats égaux et distincts ; aucune référence partagée avec le passé', async () => {
  const { tours } = await rejouer(SCENARIO.slice(0, 4));
  const t = tours[3];
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const obs = gel(structuredClone(t.s.observation)); const uni = gel(structuredClone(t.s.univers)); const passe = gel(structuredClone(t.passe));
  const fige = JSON.stringify([obs, uni, passe]);
  const r1 = decrireCandidats(obs, uni, passe, DESCRIPTIONS_OPERATIONS); const r2 = decrireCandidats(obs, uni, passe, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(r1, r2); assert.notEqual(r1, r2);
  assert.equal(JSON.stringify([obs, uni, passe]), fige);
  const h = r1.choix.flatMap((c) => c.combinaisons).flatMap((x) => x.description.historiques).find((x) => x.experiences.length > 0);
  if (h) assert.equal(passe.attentes.includes(h.elements[0].contenu), false);
});

test('A5. entrées mal formées : TypeError, aucun résultat partiel', async () => {
  const { tours } = await rejouer(SCENARIO.slice(0, 2));
  const t = tours[1];
  refuse(() => decrireCandidats(t.s.observation, t.s.univers, null, DESCRIPTIONS_OPERATIONS));
  refuse(() => decrireCandidats(t.s.observation, t.s.univers, { attentes: [], contextes: [], valeurs: [] }, DESCRIPTIONS_OPERATIONS));
  refuse(() => decrireCandidats(t.s.observation, t.s.univers, { ...t.passe, executions: 'x' }, DESCRIPTIONS_OPERATIONS));
  refuse(() => decrireCandidats(t.s.observation, t.s.univers, t.passe, DESCRIPTIONS_OPERATIONS, 42));
  refuse(() => decrireCandidats(t.s.observation, t.s.univers, t.passe));
  assert.throws(() => decrireCandidats({}, t.s.univers, t.passe, DESCRIPTIONS_OPERATIONS), TypeError);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. LE VERROU MESURÉ
test('B1. SCÉNARIO RÉEL : dès T4, 13 opérations à choisir, 159→207 combinaisons, 1 déterminée ; l\'expérience ne dit RIEN de 99 % des candidates (aucune attente, tout historique vide) ; comportement vivant inchangé', async () => {
  const { tours } = await rejouer(SCENARIO);
  assert.deepEqual(tours.map((t) => t.s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((t) => t.s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  const mesures = tours.map((t) => { const d = decrireCandidats(t.s.observation, t.s.univers, t.passe, DESCRIPTIONS_OPERATIONS); const combos = d.choix.flatMap((c) => c.combinaisons); const r = combos.map((x) => resumer(x.description)); return { determinees: d.determinees.length, choix: d.choix.length, combinaisons: combos.length, avecAttentes: r.filter((x) => x.attentes > 0).length, avecHistoire: r.filter((x) => x.H1 + x.H2 + x.H3 + x.Habsente > 0).length, sansRien: r.filter((x) => x.attentes === 0 && x.H1 + x.H2 + x.H3 + x.Habsente === 0).length }; });
  assert.deepEqual(mesures.map((m) => m.combinaisons), [0, 5, 19, 158, 174, 190, 206]);
  assert.deepEqual(mesures.map((m) => m.determinees), [2, 4, 9, 1, 1, 1, 1]);
  // T4…T7 : seules les combinaisons de symbolesDeChaine portent des attentes possibles ; aucune combinaison à choisir n'a d'historique d'engagement
  assert.deepEqual(mesures.slice(3).map((m) => m.avecAttentes), [2, 2, 2, 2]);
  assert.deepEqual(mesures.slice(3).map((m) => m.avecHistoire), [0, 0, 0, 0]);
  assert.deepEqual(mesures.slice(3).map((m) => m.sansRien), [156, 172, 188, 204]);
  // la seule déterminée (elementsObservables) a, elle, des attentes possibles et un historique H1 croissant : l'expérience ne parle que de ce qui a été fait
  const det = tours.slice(3).map((t) => resumer(decrireCandidats(t.s.observation, t.s.univers, t.passe, DESCRIPTIONS_OPERATIONS).determinees[0].description));
  assert.deepEqual(det.map((x) => x.attentes), [4, 4, 4, 4]);
  assert.deepEqual(det.map((x) => [x.contextes, x.attentes, x.H1, x.H2, x.H3, x.H4]), [[4, 4, 4, 12, 0, 24], [4, 4, 4, 12, 0, 36], [4, 4, 4, 12, 0, 48], [4, 4, 4, 12, 0, 60]]); // le passé photographié après l'automatique du tour : H1 = relationValeur engagée et réalisée (4 contextes), H2 = identités (12), H4 croissant = identités neuves jamais engagées
});

test('B2. SONDE : les sollicitations extérieures créent de l\'expérience sur UNE combinaison par opération ; les descriptions distinguent les combinaisons (H1/H2/H4) mais aucune ne dit laquelle exécuter ; trois critères arbitraires divergent', async () => {
  const { tours } = await rejouer(SONDE, true);
  const t = tours[6]; // T7
  const d = decrireCandidats(t.s.observation, t.s.univers, t.passe, DESCRIPTIONS_OPERATIONS);
  assert.equal(nbCombinaisons(d), 230);
  const sdc = d.choix.find((c) => c.operation === 'symbolesDeChaine');
  assert.equal(sdc.combinaisons.length, 6);
  const resumes = sdc.combinaisons.map((x) => ({ donnee: x.application.liaisons[0].donnee, ...resumer(x.description) }));
  // deux classes de description : les chaînes déjà traversées (3 contextes : direct + 2 prolongements) et le message neuf (1 contexte) ; même attentes possibles, mêmes historiques
  assert.deepEqual([...new Set(resumes.map((r) => `${r.contextes}/${r.attentes}/${r.H1}/${r.H2}/${r.H4}`))].sort(), ['1/1/1/3/15', '3/1/1/3/15']);
  const choisie = t.sollicitees.find((s) => s.operation === 'symbolesDeChaine').liaisons[0].donnee;
  assert.equal(resumes.find((r) => r.donnee === choisie).contextes, 1, 'l\'extérieur a choisi le message neuf (projection directe seule)');
  // trois critères qu'on pourrait écrire, et qu'on n'écrit pas : ils ne désignent pas la même combinaison
  const argmax = (f) => resumes.filter((r) => f(r) === Math.max(...resumes.map(f))).map((r) => r.donnee);
  const parAttentes = argmax((r) => r.attentes); const parH1 = argmax((r) => r.H1); const parInconnu = argmax((r) => r.H4); const parContextes = argmax((r) => r.contextes);
  assert.equal(parAttentes.length, 6, 'attentes possibles : toutes égales, aucun départage');
  assert.equal(parH1.length, 6, 'H1 : toutes égales');
  assert.equal(parInconnu.length, 6, 'inconnu : toutes égales');
  assert.deepEqual(parContextes.length, 5, 'contextes : départage par l\'ancienneté, mais à l\'inverse du choix extérieur');
  assert.equal(parContextes.includes(choisie), false);
  // composerCollection : 6 combinaisons, descriptions identiques (le passé ne distingue rien), le choix extérieur n'est pas explicable par l'expérience
  const cc = d.choix.find((c) => c.operation === 'composerCollection');
  assert.equal(new Set(cc.combinaisons.map((x) => JSON.stringify(resumer(x.description)))).size, 1);
  // ce que l'expérience dit bien : pour la combinaison centrale, relationValeur egale est H1 (porté par tous), les identités H2
  const centrale = cc.combinaisons.find((x) => x.description.contextes.some((c) => sk(c.structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)'));
  const hs = centrale.description.historiques.filter((h) => h.rangContexte === centrale.description.contextes.findIndex((c) => sk(c.structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)'));
  const rel = hs.find((h) => h.chemin.join('.') === 'relationValeur' && h.constat.valeur === 'egale');
  assert.equal(cas(rel), 'H1'); assert.equal(rel.experiences.length, 3);
  const arrivees = hs.filter((h) => h.chemin.join('.') === 'arrivee').map(cas); assert.ok(arrivees.includes('H2') && arrivees.includes('H4'), JSON.stringify(arrivees)); // anciennes identités engagées puis « autre » ; la plus récente jamais engagée
});

test('B3. COÛT : décrire toutes les candidates d\'un tour (T7 réel, 207 combinaisons) ; mesure rapportée, pas optimisée', async () => {
  const { tours } = await rejouer(SCENARIO);
  const t = tours[6];
  const t0 = performance.now();
  const d = decrireCandidats(t.s.observation, t.s.univers, t.passe, DESCRIPTIONS_OPERATIONS);
  const duree = performance.now() - t0;
  assert.equal(nbCombinaisons(d) + d.determinees.length, 207);
  assert.ok(duree < 60000, `durée ${duree} ms`);
});

test('B4. DORMANCE : aucun fichier de app/ n\'importe ni ne nomme la vue ; l\'écran, le choix et l\'exécution ne la lisent pas ; catalogue et table inchangés', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    assert.equal(/description-candidats|decrireCandidats/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/description-candidats/.test(s), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
