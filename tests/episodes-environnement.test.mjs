// EXPÉRIENCE D'AUTONOMIE 04 (branche, base v0.63.76 + autonomie-03) — L'ENVIRONNEMENT COMME OPÉRATEUR VÉCU : ce que les conséquences apprennent sans valeur.
// Preuves : projection pure des conséquences déclarées en exécutions synthétiques + descriptions de canal ; les mécanismes .69–.76 les traitent INCHANGÉS ;
// même action, conséquences différentes (écho / inversion / constante) -> régularités et attentes différentes, traçables ; actions différentes, conséquence
// comparable (constante : valeurs.arrivee = ok universel) ; histoire contradictoire (capricieux : attente egale puis autre, plus d'attente) ; aucune
// conséquence (silence : aucun opérateur, aucune possibilité) ; conséquence multiple (double : épisodes oui, attentes refusées par le contrat une issue par
// acte) ; comportement : l'environnement devient une possibilité, jamais une détermination ; dormance ; provocation extérieure visible (harnais).
import { test } from 'node:test';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/episodes-environnement.js';
import { PREFIXE_ENVIRONNEMENT, ENTREE_EMISE } from '../app/langage/episodes-environnement.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { projeterEnvironnements } from '../app/langage/episodes-environnement.js';
import { emettreProduction } from '../app/langage/emission.js';
import { consequencesDesEmissions } from '../app/langage/consequences-emissions.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { issueDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { memesCouvertures } from '../app/langage/couverture-occurrences.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerReception } from '../app/langage/connaissances.js';


const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'episodes-environnement.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^projeterEnvironnements : /.test(e.message));
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
const au = (cpc, chemin) => cpc.chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
const texteDe = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
let compteurIds = 0;
// Un monde : la boucle réelle + un environnement + une PROVOCATION EXTÉRIEURE visible (le harnais émet, à chaque tour, la dernière production mécanique).
function monde(nom, reagir) {
  const magasin = magasinMemoireVive();
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const ex2 = () => magasin.lireTout('executionsOperations');
  const boite = []; const tours = []; const contextes = []; const attentes = []; const journal = [];
  let nEmissions = 0; const environnement = { nom, remettre: ({ emission, valeur }) => { for (const texte of reagir(valeur, tours.length, nEmissions)) boite.push({ texte, idEmission: emission.id }); nEmissions += 1; } };
  const photo = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), emissions: await magasin.lireTout('emissions'), receptions: await magasin.lireTout('receptions') });
  // le passé « vu comme opérateur » : exécutions réelles + projection des conséquences ; catalogue + descriptions des environnements
  const vecu = async () => { const p = await photo(); const proj = projeterEnvironnements(p.emissions, p.receptions, p.valeurs); return { ...p, executionsVues: [...p.executions, ...proj.executions], descriptionsVues: [...DESCRIPTIONS_OPERATIONS, ...proj.descriptions] }; };
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }));
    let idMessage = null;
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async (m) => { idMessage = m.id; return { texte: 'ok' }; }, nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    await enregistrerReception(magasin, { environnement: nom, idDonnee: idMessage, idEmission });
    tours.push({ texte, s, idMessage });
    return s;
  }
  return {
    nom, tours, contextes, attentes, journal, magasin, photo, vecu,
    vivre: async (texte) => tour(texte),
    recevoirBoite: async () => { const lot = boite.splice(0); for (const { texte, idEmission } of lot) await tour(texte, idEmission); return lot.length; },
    // ACTION PROVOQUÉE (provenance : 'harnais', jamais Naissance) : émettre la production donnée ; AVANT l'issue, écrire contexte(s) prospectif(s) et attentes « au fil de l'eau »
    // PROVOCATION EXTÉRIEURE (harnais) : obtenir une production CHAÎNE neuve pour ce tour : symbolesDeChaine(message) puis composerCollection(…) sollicités
    produireChaine: async () => {
      const t = tours.at(-1); const { observation, univers } = t.s; const { executerApplicationSollicitee } = await import('../app/langage/execution-sollicitee.js');
      const soll = async (operation, liaisons) => { const r = await executerApplicationSollicitee({ observation, application: { operation, liaisons }, univers }, { magasin, table: TABLE_OPERATIONS }); if (r.statut !== 'executee') throw new Error(`${operation} : ${r.statut}`); return r.execution; };
      const faits = await ex2();
      // 1. une collection de symboles non encore composée, PRÉSENTE dans l'observation de ce tour -> composerCollection (chaîne neuve)
      const R = faits.find((e) => e.operation === 'symbolesDeChaine' && observation.donneesExaminees.includes(e.id) && !faits.some((f) => f.operation === 'composerCollection' && f.liaisons[0].donnee === e.id));
      let C = null; if (R) C = await soll('composerCollection', [{ entree: 'elements', donnee: R.id }]);
      // 2. préparer le tour suivant : symbolesDeChaine sur le message de ce tour
      if (!faits.some((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === t.idMessage)) { try { await soll('symbolesDeChaine', [{ entree: 'chaine', donnee: t.idMessage }]); } catch { /* déjà déterminée mécaniquement ou impossible */ } }
      return C;
    },
    emettre: async (idExecution) => {
      const v = await vecu();
      const application = { operation: `environnement:${nom}`, liaisons: [{ entree: 'emis', donnee: idExecution }] };
      const avant = contextesProspectifs(application, v.valeurs, v.executionsVues, v.descriptionsVues);
      const r = await emettreProduction({ idExecution, idObservation: tours.at(-1).s.observation.id }, { magasin, environnement });
      const designation = { id: r.emission.id, horodatage: r.emission.horodatage };
      const lignes = avant.map((c, i) => ({ id: `${r.emission.id}/c${i}`, horodatage: r.emission.horodatage, idDesignation: r.emission.id, ...c }));
      contextes.push(...lignes);
      for (const c of lignes) { try { for (const a of attentesDuContexteProspectif(c, designation, contextes, v.valeurs, v.executionsVues, v.descriptionsVues)) attentes.push({ id: `${c.id}/a${attentes.length}`, horodatage: r.emission.horodatage, ...a }); } catch (e) { journal.push({ tour: tours.length, refus: e.message.slice(0, 90) }); } }
      journal.push({ tour: tours.length, idExecution, emission: r.emission.id, provenance: 'harnais', contextes: lignes.length, attentes: attentes.filter((a) => a.idDesignation === r.emission.id).length });
      return r;
    },
  };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const ENVS = {
  echo: (v) => [texteDe(v)],
  inversion: (v) => [[...texteDe(v)].reverse().join('')],
  constante: () => ['ok'],
  silence: () => [],
  capricieux: (v, t, n) => (n < 3 ? [texteDe(v)] : [[...texteDe(v)].reverse().join('')]),
  intermittent: (v, t, n) => (n % 2 === 0 ? [texteDe(v)] : []),
  double: (v) => [texteDe(v), `${texteDe(v)} !`],
};
// vivre : à chaque tour, le harnais émet la production mécanique la plus récente, puis l'environnement répond (ou non) au tour suivant (les réponses deviennent des tours)
async function vivreAvecProvocation(nom) {
  const w = monde(nom, ENVS[nom]);
  for (const texte of SCENARIO) {
    await w.vivre(texte);
    const nouvelle = await w.produireChaine();
    if (nouvelle) await w.emettre(nouvelle.id);
    await w.recevoirBoite();
  }
  return w;
}

const E = (id, env, idExecution = 'x-1') => ({ id, horodatage: 'h', idExecution, environnement: env, idObservation: 'o' });
const R = (id, env, idEmission, idDonnee) => ({ id, horodatage: 'h2', environnement: env, idDonnee, idEmission });
const V = [{ id: 'm1', valeur: 'un' }, { id: 'm2', valeur: 'deux' }];

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. exports ; import unique (forme déclarée du canal) ; aucune inférence de forme, aucune valence, aucun nom métier ; entrée quelconque / sortie = forme du message', () => {
  assert.deepEqual(Object.keys(module).sort(), ['ENTREE_EMISE', 'PREFIXE_ENVIRONNEMENT', 'projeterEnvironnements']);
  assert.deepEqual([...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]), ['./source-message.js']);
  assert.equal(/typeof .*=== 'string' \? \{ forme|genre:|prefer|préfér|score|confiance|recompense|récompense|reussite|réussite|correct|jugement|curiosit|nouveaut|\.sort\(\(|Math\.|\bDate\b|magasin|\.ecrire|\.lireTout/i.test(CODE), false);
  assert.equal(/symbolesDeChaine|composerCollection|elementsObservables|relationValeur|egale|differente/.test(CODE), false);
  const { descriptions } = projeterEnvironnements([E('e1', 'A')], [R('r1', 'A', 'e1', 'm1')], V);
  assert.deepEqual(descriptions, [{ nom: `${PREFIXE_ENVIRONNEMENT}A`, entrees: { [ENTREE_EMISE]: { forme: 'quelconque' } }, sortie: DESCRIPTION_SOURCE_MESSAGE.forme }]);
});

test('A2. PROJECTION : réception déclarée -> exécution synthétique (id = réception, désignation = émission, opérateur = environnement, entrée = production émise, résultat = valeur reçue) ; sans réception -> rien ; indépendante -> rien ; double -> deux exécutions, même désignation ; une description par environnement répondant', () => {
  const { executions, descriptions } = projeterEnvironnements([E('e1', 'A'), E('e2', 'A', 'x-2'), E('e3', 'B')], [R('r0', 'A', null, 'm1'), R('r1', 'A', 'e1', 'm1'), R('r2', 'A', 'e2', 'm1'), R('r3', 'A', 'e2', 'm2')], V);
  assert.deepEqual(executions, [
    { id: 'r1', horodatage: 'h2', idDesignation: 'e1', operation: 'environnement:A', liaisons: [{ entree: 'emis', donnee: 'x-1' }], resultat: 'un' },
    { id: 'r2', horodatage: 'h2', idDesignation: 'e2', operation: 'environnement:A', liaisons: [{ entree: 'emis', donnee: 'x-2' }], resultat: 'un' },
    { id: 'r3', horodatage: 'h2', idDesignation: 'e2', operation: 'environnement:A', liaisons: [{ entree: 'emis', donnee: 'x-2' }], resultat: 'deux' },
  ]);
  assert.deepEqual(descriptions.map((d) => d.nom), ['environnement:A'], 'B n\'a jamais répondu : aucun opérateur B');
  assert.deepEqual(projeterEnvironnements([], [], []), { executions: [], descriptions: [] });
  refuse(() => projeterEnvironnements([E('e1', 'A')], [R('r1', 'A', 'e9', 'm1')], V));
  refuse(() => projeterEnvironnements([E('e1', 'A')], [R('r1', 'B', 'e1', 'm1')], V));
  refuse(() => projeterEnvironnements([E('e1', 'A')], [R('r1', 'A', 'e1', 'm9')], V));
  refuse(() => projeterEnvironnements([E('e1', 'A'), E('e1', 'A')], [], V));
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const em = gel([E('e1', 'A')]); const re = gel([R('r1', 'A', 'e1', 'm1')]); const va = gel(structuredClone(V)); const fige = JSON.stringify([em, re, va]);
  const s1 = projeterEnvironnements(em, re, va); const s2 = projeterEnvironnements(em, re, va); assert.deepEqual(s1, s2); assert.notEqual(s1, s2); assert.equal(JSON.stringify([em, re, va]), fige);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. CE QUI S'APPREND SANS VALEUR
async function mesurer(nom) {
  const w = await vivreAvecProvocation(nom);
  const v = await w.vecu();
  const cons = consequencesDesEmissions(v.emissions, v.receptions);
  const { episodes } = episodesDeTransformation(v.valeurs, v.executionsVues, v.descriptionsVues);
  const directs = episodes.filter((e) => e.chemin.length === 1 && e.chemin[0].operation === `environnement:${nom}`);
  const rel = directs.reduce((c, e) => { c[e.relationValeur] = (c[e.relationValeur] ?? 0) + 1; return c; }, {});
  const issues = []; let refusAttentes = w.journal.filter((j) => j.refus).length;
  for (const a of w.attentes) issues.push(issueDeLAttenteProspective(a, w.contextes.find((c) => c.id === a.idContexte), v.valeurs, v.executionsVues, v.descriptionsVues));
  const directes = issues.filter((i) => i.structure.length === 1);
  const relAtt = directes.filter((i) => i.chemin.join('.') === 'relationValeur').map((i) => `${i.constat.valeur}→${i.issue ? i.statut : 'sans'}`);
  const valAtt = directes.filter((i) => i.chemin.join('.') === 'valeurs.arrivee').map((i) => `${i.constat.valeur}→${i.issue ? i.statut : 'sans'}`);
  let constants = [];
  if (directs.length) { const cpc = constatsParChemin(directs.map((e) => ({ chemin: [e.depart, e.arrivee], contenu: e }))); constants = cpc.chemins.filter((c) => c.constats.length === 1 && memesCouvertures(c.constats[0].couverture, cpc.universelle) && /^(relationValeur|valeurs\.arrivee)$/.test(c.chemin.join('.'))).map((c) => `${c.chemin.join('.')}=${c.constats[0].valeur}`); }
  // comportement : avec la description de l'environnement présentée au calcul des possibilités
  const t = w.tours.at(-1);
  const obs = await observerPossibilites({ id: t.idMessage, texte: t.texte }, { enregistrer: async (d) => ({ id: 'o', ...d }), lireExecutions: async () => v.executionsVues, descriptions: v.descriptionsVues });
  const s = applicationsSollicitables(obs.observation, v.descriptionsVues, obs.univers);
  const comportement = { determinees: s.applications.length, determineesEnv: s.applications.filter((a) => a.operation.startsWith('environnement:')).length, choix: s.choixAFaire.length, envAChoisir: s.choixAFaire.filter((o) => o.startsWith('environnement:')).length, candidatsEnv: obs.observation.possibilites.filter((p) => p.operation.startsWith('environnement:')).length };
  return { w, v, consequences: cons.emissions.map((e) => e.consequences.length).join(''), directs: directs.length, rel, attentes: w.attentes.length, relAtt, valAtt, constants, refusAttentes, comportement, episodes: episodes.length };
}

test('B1. MÊME ACTION, CONSÉQUENCES DIFFÉRENTES : écho -> relationValeur egale (5/5), attentes egale realisée ; inversion -> differente (5/5), attentes differente réalisées ; la différence est dans les lignes de réception, rien d\'autre', async () => {
  const echo = await mesurer('echo'); const inv = await mesurer('inversion');
  assert.equal(echo.consequences, '11111'); assert.equal(inv.consequences, '11111');
  assert.deepEqual(echo.rel, { egale: 5 }); assert.deepEqual(inv.rel, { differente: 5 });
  assert.deepEqual(echo.relAtt, ['egale→realisee', 'egale→realisee', 'egale→realisee']); assert.deepEqual(inv.relAtt, ['differente→realisee', 'differente→realisee', 'differente→realisee']);
  assert.deepEqual(echo.constants, ['relationValeur=egale']); assert.deepEqual(inv.constants, ['relationValeur=differente']);
  // même provocation, mêmes productions émises (mêmes textes), même scénario : seules les réceptions diffèrent
  assert.deepEqual(echo.w.journal.filter((j) => j.provenance).map((j) => j.tour), inv.w.journal.filter((j) => j.provenance).map((j) => j.tour));
  assert.ok(echo.w.journal.every((j) => !j.provenance || j.provenance === 'harnais'), 'aucune émission n\'est une initiative de Naissance');
});

test('B2. ACTIONS DIFFÉRENTES, CONSÉQUENCE COMPARABLE : constante renvoie « ok » quoi qu\'on émette -> relationValeur differente ET valeurs.arrivee = ok universel ; attente de valeur « ok » réalisée (ce que l\'inversion ne donne pas)', async () => {
  const c = await mesurer('constante');
  assert.deepEqual(c.rel, { differente: 5 });
  assert.deepEqual(c.constants.sort(), ['relationValeur=differente', 'valeurs.arrivee=ok']);
  assert.deepEqual(c.valAtt, ['ok→realisee', 'ok→realisee', 'ok→realisee']);
  const inv = await mesurer('inversion'); assert.equal(inv.constants.includes('valeurs.arrivee=ok'), false); assert.equal(inv.valAtt.filter((x) => x.endsWith('realisee')).length, 0);
});

test('B3. HISTOIRE CONTRADICTOIRE : capricieux (écho ×3 puis inversion) -> egale ×3 et differente ×2 ; attente egale réalisée, puis egale -> autre, puis plus aucune attente de relation (B non universel) ; la contradiction est conservée, rien n\'est réécrit', async () => {
  const c = await mesurer('capricieux');
  assert.deepEqual(c.rel, { egale: 3, differente: 2 });
  assert.deepEqual(c.relAtt, ['egale→realisee', 'egale→autre']);
  assert.equal(c.constants.includes('relationValeur=egale'), false);
});

test('B4. AUCUNE CONSÉQUENCE : silence -> 5 émissions, 0 réception déclarée, 0 épisode, 0 attente, aucun opérateur, aucune possibilité d\'émettre ; l\'absence n\'est visible que par consequencesDesEmissions', async () => {
  const s = await mesurer('silence');
  assert.equal(s.consequences, '00000'); assert.equal(s.directs, 0); assert.equal(s.attentes, 0); assert.deepEqual(s.v.descriptionsVues.length, DESCRIPTIONS_OPERATIONS.length);
  assert.deepEqual(s.comportement, { determinees: 1, determineesEnv: 0, choix: 13, envAChoisir: 0, candidatsEnv: 0 });
});

test('B5. CONSÉQUENCE MULTIPLE : double -> 2 réceptions par émission, 10 épisodes directs (egale ×5, differente ×5) ; les attentes sont REFUSÉES par le contrat « une issue par acte » (.73) : limite explicite, pas une perte silencieuse', async () => {
  const d = await mesurer('double');
  assert.equal(d.consequences, '22222'); assert.deepEqual(d.rel, { egale: 5, differente: 5 }); assert.equal(d.attentes, 0); assert.ok(d.refusAttentes > 0);
  assert.ok(d.w.journal.some((j) => /2 exécutions portent la désignation/.test(j.refus)));
});

test('B6. CONSÉQUENCE INTERMITTENTE : une attente dont l\'émission n\'a pas eu de réponse a une issue null (ni démentie ni réalisée)', async () => {
  const i = await mesurer('intermittent');
  assert.equal(i.consequences, '10101'); assert.deepEqual(i.rel, { egale: 3 });
  assert.deepEqual(i.relAtt, ['egale→sans', 'egale→realisee']);
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. COMPORTEMENT
test('C1. L\'ENVIRONNEMENT VÉCU DEVIENT UNE POSSIBILITÉ, JAMAIS UNE DÉTERMINATION : avec sa description présentée, écho est « à choisir » (82 candidates), 0 déterminée ; silence n\'existe pas ; les déterminées sont les mêmes qu\'avant ; deux Naissance aux histoires différentes ont les MÊMES options et des attentes différentes', async () => {
  const echo = await mesurer('echo'); const inv = await mesurer('inversion'); const sil = await mesurer('silence');
  assert.deepEqual(echo.comportement, { determinees: 1, determineesEnv: 0, choix: 14, envAChoisir: 1, candidatsEnv: 82 });
  assert.deepEqual(inv.comportement, echo.comportement, 'mêmes options');
  assert.deepEqual(sil.comportement.choix, 13);
  assert.notDeepEqual(echo.relAtt, inv.relAtt, 'attentes différentes');
});

test('C2. DORMANCE ET COMPORTEMENT VIVANT : aucun fichier de app/ n\'importe la vue ; aucun environnement n\'entre dans le catalogue réel (17) ; sans provocation, 7 tours identiques', async () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) { if (f === CHEMIN) continue; assert.equal(/episodes-environnement|projeterEnvironnements/.test(readFileSync(f, 'utf8')), false, f); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
  const w = monde('conversation', () => []);
  for (const texte of SCENARIO) await w.vivre(texte);
  assert.deepEqual(w.tours.map((t) => t.s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(w.tours.map((t) => t.s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  const p = await w.photo(); assert.equal(p.executions.length, 19); assert.equal(p.emissions.length, 0);
});
