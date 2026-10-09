// === DEBUT_TEST_PROJECTION_ENVIRONNEMENT_FLUX ===
// v0.63.82 — PROJECTION ENVIRONNEMENTALE SUR LE FLUX RÉEL DE J-B (décision ChatGPT, 09/10/2026) : les émissions/réceptions persistées par
// v0.63.80/.81 (chaque production du lot est émise vers 'conversation' ; une réception n'existe que par le geste « Répondre ») deviennent
// lisibles par les mécanismes génériques — épisodes, familles, constats, contextes prospectifs, attentes, issues — via la vue PURE
// projeterEnvironnements (episodes-environnement.js), sans table, sans écriture, sans valence. Cas A → I demandés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

import { projeterEnvironnements, PREFIXE_ENVIRONNEMENT, ENTREE_EMISE } from '../app/langage/episodes-environnement.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequencesDesEmissions } from '../app/langage/consequences-emissions.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerEmission, enregistrerReception, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { issueDuContexteProspectif } from '../app/langage/issue-contexte-prospectif.js';
import { issueDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
const ENV = `${PREFIXE_ENVIRONNEMENT}conversation`;

// ---------------------------------------------------------------------------------------------------- harnais = câblage de main.js (J-B)
let compteur = 0;
function monde() {
  const magasin = magasinMemoireVive();
  const nouvelId = (p) => `${p}-${++compteur}`;
  const ex2 = () => magasin.lireTout('executionsOperations');
  const tours = []; const contextes = []; const attentes = [];
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), async ({ observation, univers }) => {
      const lot = await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      return { ...lot, emises, echecEmission: echec };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    // ce qu'une chaîne .72/.74 écrirait si l'émission était une désignation : contextes de « environnement:conversation(emis = production) » sur le
    // vécu projeté d'AVANT cette émission, puis attentes A = B (recalcul pur dans le harnais ; rien de tel n'existe dans app/)
    const vAvant = await vecu();
    const lignesEm = await magasin.lireTout('emissions');
    for (const e of s.emises) {
      const em = lignesEm.find((x) => x.id === e.idEmission);
      const ctx = contextesProspectifs({ operation: ENV, liaisons: [{ entree: ENTREE_EMISE, donnee: e.idExecution }] }, vAvant.valeurs, vAvant.executionsVues, vAvant.descriptionsVues);
      const lignes = ctx.map((c, i) => ({ id: `${e.idEmission}/c${i}`, horodatage: em.horodatage, idDesignation: e.idEmission, operation: e.operation, ...c }));
      contextes.push(...lignes);
      for (const c of lignes) for (const a of attentesDuContexteProspectif(c, { id: e.idEmission, horodatage: em.horodatage }, contextes, vAvant.valeurs, vAvant.executionsVues, vAvant.descriptionsVues)) attentes.push({ id: `${c.id}/a${attentes.length}`, operation: e.operation, ...a });
    }
    const reception = idEmission ? await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }) : null;
    tours.push({ texte, s, reception });
    return s;
  }
  const vecu = async () => {
    const valeurs = await magasin.lireTout('valeursDonnees'); const executions = await ex2();
    const emissions = await magasin.lireTout('emissions'); const receptions = await magasin.lireTout('receptions');
    const proj = projeterEnvironnements(emissions, receptions, valeurs);
    return { valeurs, executions, emissions, receptions, proj, executionsVues: [...executions, ...proj.executions], descriptionsVues: [...DESCRIPTIONS_OPERATIONS, ...proj.descriptions] };
  };
  return { magasin, tour, tours, vecu, contextes, attentes };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
// « Christophe » répond (geste Répondre) à l'émission de elementsObservables du tour précédent, à chaque tour
async function vivreAvecReponses(n = SCENARIO.length, texteReponse = null) {
  const w = monde(); let enAttente = null;
  for (const texte of SCENARIO.slice(0, n)) {
    const s = await w.tour(enAttente && texteReponse ? texteReponse : texte, enAttente);
    const cible = s.emises.find((e) => e.operation === 'elementsObservables');
    enAttente = cible ? cible.idEmission : null;
  }
  return w;
}

// ============================================================================================================== A → F : LA PROJECTION ELLE-MÊME
test('A. ÉMISSION SANS RÉCEPTION : aucune exécution synthétique ; aucune description d\'opérateur ; l\'émission reste lisible seulement par consequencesDesEmissions (couverture vide)', async () => {
  const w = monde();
  for (const t of SCENARIO.slice(0, 3)) await w.tour(t);
  const v = await w.vecu();
  assert.equal(v.emissions.length, 15); assert.equal(v.receptions.length, 0);
  assert.deepEqual(v.proj, { executions: [], descriptions: [] });
  const vue = consequencesDesEmissions(v.emissions, v.receptions);
  assert.equal(vue.emissions.length, 15); assert.ok(vue.emissions.every((e) => e.consequences.length === 0));
});

test('B. ÉMISSION + RÉCEPTION DÉCLARÉE : projection EXACTE — id = réception, horodatage = réception, idDesignation = émission, opération = environnement:conversation, entrée emis = production émise, résultat = valeur du message reçu ; une description de canal, sortie = forme déclarée du message', async () => {
  const w = monde();
  const s1 = await w.tour('bonjour Pixel');
  const e = s1.emises[1]; // symbolesDeChaine
  const s2 = await w.tour('oui je te réponds', e.idEmission);
  const v = await w.vecu();
  assert.equal(v.proj.executions.length, 1);
  const r = v.receptions[0];
  assert.deepEqual(v.proj.executions[0], { id: r.id, horodatage: r.horodatage, idDesignation: e.idEmission, operation: ENV, liaisons: [{ entree: ENTREE_EMISE, donnee: e.idExecution }], resultat: 'oui je te réponds' });
  assert.equal(v.proj.descriptions.length, 1); assert.equal(v.proj.descriptions[0].nom, ENV); assert.deepEqual(v.proj.descriptions[0].entrees, { emis: { forme: 'quelconque' } });
  assert.equal(r.idDonnee, s2.observation.idMessage);
  assert.equal(/prefer|préfér|score|confiance|recompense|récompense|reussite|réussite|positi|négati|negati|utile|ignor|silence|rejet|échec|echec/i.test(sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', 'episodes-environnement.js'), 'utf8'))), false);
});

test('C. RÉCEPTION TARDIVE : avant la réponse, l\'émission ancienne n\'a aucune exécution synthétique ; après une réponse déclarée trois tours plus tard, son expérience devient lisible (épisode départ = production, arrivée = message reçu) ; identité stable = celle de la réception', async () => {
  const w = monde();
  const s1 = await w.tour('bonjour Pixel'); const e = s1.emises[0];
  await w.tour('bonjour Luna'); await w.tour('bonjour Pixel');
  let v = await w.vecu();
  assert.equal(v.proj.executions.filter((x) => x.idDesignation === e.idEmission).length, 0);
  const s4 = await w.tour('réponse tardive', e.idEmission);
  v = await w.vecu();
  const synth = v.proj.executions.filter((x) => x.idDesignation === e.idEmission);
  assert.equal(synth.length, 1); assert.equal(synth[0].id, v.receptions[0].id); assert.equal(synth[0].resultat, 'réponse tardive');
  const { episodes } = episodesDeTransformation(v.valeurs, v.executionsVues, v.descriptionsVues);
  const ep = episodes.filter((x) => x.chemin.some((k) => k.operation === ENV));
  assert.ok(ep.length >= 1);
  assert.ok(ep.some((x) => x.arrivee === v.receptions[0].id && x.chemin.at(-1).execution === v.receptions[0].id && x.chemin.at(-1).de === e.idExecution));
  assert.equal(s4.automatiques.length, 1, 'le tour de la réponse tardive est un tour normal');
  // recalcul : mêmes identités à chaque appel, rien de persisté
  const v2 = await w.vecu();
  assert.deepEqual(v2.proj, v.proj); assert.notEqual(v2.proj, v.proj);
  assert.deepEqual(TABLES.length, 26);
});

test('D. PLUSIEURS RÉCEPTIONS SUR UNE ÉMISSION : deux exécutions synthétiques de même désignation, deux épisodes, aucune n\'est choisie ni fusionnée ; l\'issue du contexte (« une issue par acte ») refuse explicitement, rien n\'est inventé', async () => {
  const w = monde();
  const s1 = await w.tour('bonjour Pixel'); const e = s1.emises[1];
  await w.tour('première réponse', e.idEmission);
  await w.tour('seconde réponse', e.idEmission);
  const v = await w.vecu();
  const synth = v.proj.executions.filter((x) => x.idDesignation === e.idEmission);
  assert.equal(synth.length, 2); assert.deepEqual(synth.map((x) => x.resultat), ['première réponse', 'seconde réponse']); assert.notEqual(synth[0].id, synth[1].id);
  const { episodes } = episodesDeTransformation(v.valeurs, v.executionsVues, v.descriptionsVues);
  assert.equal(episodes.filter((x) => x.chemin.length === 1 && x.chemin[0].operation === ENV && x.chemin[0].de === e.idExecution).length, 2, 'deux épisodes directs (un par réception) ; les chemins plus longs (message > symbolesDeChaine > environnement) s\'y ajoutent sans fusion');
  const ctx = contextesProspectifs({ operation: ENV, liaisons: [{ entree: ENTREE_EMISE, donnee: e.idExecution }] }, v.valeurs, v.executions, DESCRIPTIONS_OPERATIONS);
  const fige = { id: 'c', horodatage: '0', idDesignation: e.idEmission, ...ctx[0] };
  assert.throws(() => issueDuContexteProspectif(fige, v.valeurs, v.executionsVues, v.descriptionsVues), /2 exécutions portent la désignation/);
  const vue = consequencesDesEmissions(v.emissions, v.receptions);
  assert.equal(vue.emissions.find((x) => x.id === e.idEmission).consequences.length, 2);
});

test('E. DONNÉE ORDINAIRE SANS idEmission : un message ordinaire ne crée aucune réception (J-B) ; une réception « indépendante » (idEmission null) écrite explicitement ne produit aucune exécution synthétique ; aucune causalité par le temps ou l\'ordre', async () => {
  const w = monde();
  const s1 = await w.tour('bonjour Pixel');
  const s2 = await w.tour('bonjour Luna'); // arrivé APRÈS les émissions de T1, sans référence
  let v = await w.vecu();
  assert.equal(v.receptions.length, 0); assert.deepEqual(v.proj.executions, []);
  await enregistrerReception(w.magasin, { environnement: 'conversation', idDonnee: s2.observation.idMessage, idEmission: null });
  v = await w.vecu();
  assert.equal(v.receptions.length, 1); assert.deepEqual(v.proj, { executions: [], descriptions: [] });
  assert.deepEqual(consequencesDesEmissions(v.emissions, v.receptions).independantes, [[v.receptions[0].id]]);
  assert.ok(s1.emises.length > 0);
});

test('F. ENVIRONNEMENTS DIFFÉRENTS : une émission vers « essai » et une vers « conversation » ; une réception d\'« essai » ne peut viser que l\'émission d\'« essai » (refus sinon) ; deux opérateurs distincts, aucun mélange', async () => {
  const w = monde();
  const s1 = await w.tour('bonjour Pixel'); const eConv = s1.emises[0];
  const eEssai = await enregistrerEmission(w.magasin, { idExecution: eConv.idExecution, environnement: 'essai', idObservation: s1.observation.id });
  const s2 = await w.tour('bonjour Luna', eConv.idEmission);
  await assert.rejects(enregistrerReception(w.magasin, { environnement: 'essai', idDonnee: s2.observation.idMessage, idEmission: eConv.idEmission }), /n'a pas été adressée à cet environnement/);
  await enregistrerReception(w.magasin, { environnement: 'essai', idDonnee: s2.observation.idMessage, idEmission: eEssai.id });
  const v = await w.vecu();
  assert.deepEqual(v.proj.descriptions.map((d) => d.nom), [ENV, `${PREFIXE_ENVIRONNEMENT}essai`]);
  assert.deepEqual(v.proj.executions.map((x) => [x.operation, x.idDesignation]).sort(), [[ENV, eConv.idEmission], [`${PREFIXE_ENVIRONNEMENT}essai`, eEssai.id]].sort());
  // une réception mal formée (émission inconnue) fait refuser la vue entière : rien de partiel, rien d'inventé
  assert.throws(() => projeterEnvironnements(v.emissions, [...v.receptions, { id: 'r-x', horodatage: '0', environnement: 'conversation', idDonnee: s2.observation.idMessage, idEmission: 'emission-inconnue' }], v.valeurs), /absente/);
});

// ============================================================================================================== G / H : LA CHAÎNE GÉNÉRIQUE
test('G. CHAÎNE GÉNÉRIQUE : réponses déclarées aux émissions de elementsObservables → épisodes → familles/constats → contexte prospectif d\'une nouvelle émission → ATTENTES écrites AVANT la réception suivante → issue RÉALISÉE après la réception ; texte constant → le texte reçu lui-même est anticipé', async () => {
  const w = await vivreAvecReponses(6, 'oui');
  const v = await w.vecu();
  assert.equal(v.receptions.length, 4); assert.equal(v.proj.executions.length, 4); // elementsObservables n'est émise qu'à partir du 2e tour : réponses aux tours 3 à 6
  const { episodes } = episodesDeTransformation(v.valeurs, v.executionsVues, v.descriptionsVues);
  const env = episodes.filter((x) => x.chemin.some((k) => k.operation === ENV));
  assert.ok(env.length >= 4);
  const { familles } = famillesDEpisodes({ episodes });
  const fam = familles.filter((f) => f.structure.some((s) => s.operation === ENV)).map((f) => sk(f.structure));
  assert.ok(fam.includes(`${ENV}(emis)`)); assert.ok(fam.includes(`elementsObservables(elements)>${ENV}(emis)`));
  // constats par chemin sur les épisodes directs : relationValeur non_comparable universel (liste émise vs texte reçu), valeurs.arrivee = "oui" universel
  const directs = env.filter((x) => x.chemin.length === 1);
  const { universelle, chemins } = constatsParChemin(directs.map((x) => ({ chemin: [x.arrivee], contenu: Object.hasOwn(x, 'valeurs') && x.valeurs !== undefined ? { relationValeur: x.relationValeur, valeurs: x.valeurs } : { relationValeur: x.relationValeur } })));
  const rv = chemins.find((c) => c.chemin.join('.') === 'relationValeur');
  assert.equal(rv.constats.length, 1); assert.equal(rv.constats[0].valeur, 'non_comparable'); assert.equal(rv.constats[0].couverture.length, universelle.length);
  // contextes écrits à chaque émission : avec témoins pour la classe répondue seulement
  const parOp = {}; for (const c of w.contextes) { parOp[c.operation] ??= [0, 0]; parOp[c.operation][0] += 1; if (c.temoins.length > 0) parOp[c.operation][1] += 1; }
  assert.ok(parOp.elementsObservables[1] > 0);
  for (const [op, [, t]] of Object.entries(parOp)) if (op !== 'elementsObservables') assert.equal(t, 0, op);
  // attentes écrites AVANT l'issue : toutes sur la classe répondue ; relation non_comparable / differente et le texte « oui » anticipés
  assert.ok(w.attentes.length > 0, 'des attentes se forment avant la réception');
  assert.ok(w.attentes.every((a) => a.operation === 'elementsObservables'));
  assert.ok(w.attentes.some((a) => a.chemin.join('.') === 'relationValeur' && a.constat.valeur === 'non_comparable'));
  assert.ok(w.attentes.some((a) => a.chemin.join('.') === 'valeurs.arrivee' && a.constat.valeur === 'oui'), 'le texte reçu constant est anticipé');
  assert.equal(/reussite|réussite|recompense|récompense|score|preference|préférence/i.test(JSON.stringify(w.attentes)), false);
  // la DERNIÈRE émission de elementsObservables n'a pas encore de réponse : ses attentes sont SANS ISSUE ; après la réponse « oui » : RÉALISÉES
  const derniereEm = [...w.contextes].reverse().find((c) => c.operation === 'elementsObservables').idDesignation;
  const attDerniere = w.attentes.filter((a) => a.idDesignation === derniereEm);
  assert.ok(attDerniere.length > 0);
  const ctxDe = (a) => w.contextes.find((c) => c.id === a.idContexte);
  for (const a of attDerniere) assert.equal(issueDeLAttenteProspective(a, ctxDe(a), v.valeurs, v.executionsVues, v.descriptionsVues).issue, null, 'AVANT la réception : sans issue');
  await w.tour('oui', derniereEm);
  const v2 = await w.vecu();
  const apres = attDerniere.map((a) => issueDeLAttenteProspective(a, ctxDe(a), v2.valeurs, v2.executionsVues, v2.descriptionsVues));
  assert.ok(apres.every((r) => r.issue !== null));
  assert.ok(attDerniere.every((a, i) => a.chemin.join('.') !== 'relationValeur' || apres[i].statut === 'realisee'), 'toutes les attentes de relation sont réalisées');
  assert.ok(attDerniere.some((a, i) => a.chemin.join('.') === 'valeurs.arrivee' && apres[i].statut === 'realisee' && apres[i].reel.valeur === 'oui'));
  // les attentes d'identité (identifiant d'une réception passée) donnent « autre » : même bruit qu'au jalon 1, conservé tel quel
  assert.ok(attDerniere.some((a, i) => /arrivee|execution|vers/.test(a.chemin.join('.')) && !/valeurs/.test(a.chemin.join('.')) && apres[i].statut === 'autre'));
});

test('H. SILENCE : une émission jamais répondue garde ses attentes « sans issue » (issue null) — jamais « autre », jamais « absente », aucun statut d\'échec, même après plusieurs tours ; les classes jamais répondues n\'ont aucun contexte avec témoin et aucune attente', async () => {
  const w = await vivreAvecReponses(6, 'oui');
  const derniereEm = [...w.contextes].reverse().find((c) => c.operation === 'elementsObservables').idDesignation;
  const attDerniere = w.attentes.filter((a) => a.idDesignation === derniereEm);
  assert.ok(attDerniere.length > 0);
  await w.tour('fin'); await w.tour('bis'); await w.tour('ter'); // trois tours ordinaires : aucune réponse à cette émission
  const v = await w.vecu();
  for (const a of attDerniere) {
    const r = issueDeLAttenteProspective(a, w.contextes.find((c) => c.id === a.idContexte), v.valeurs, v.executionsVues, v.descriptionsVues);
    assert.equal(r.issue, null); assert.equal(Object.hasOwn(r, 'statut'), false); assert.equal(Object.hasOwn(r, 'reel'), false);
  }
  assert.equal(v.proj.executions.filter((x) => x.idDesignation === derniereEm).length, 0);
  for (const c of w.contextes.filter((c) => c.operation !== 'elementsObservables')) assert.equal(c.temoins.length, 0, c.operation);
  assert.equal(w.attentes.filter((a) => a.operation !== 'elementsObservables').length, 0);
  assert.equal(/sans r[ée]ponse|ignor|rejet|[ée]chec/i.test(sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', 'episodes-environnement.js'), 'utf8'))), false);
});

// ============================================================================================================== I : COMPORTEMENT ET DORMANCE
test('I. COMPORTEMENT : mêmes opérations choisies et exécutées avec ou sans réceptions ; la projection n\'est lue que par executions-vecues.js (recalculée, jamais persistée) ; aucune table, base 22 / schéma 12 ; catalogue 17 ; aucune origine \'experience\'', async () => {
  const sans = monde(); for (const t of SCENARIO) await sans.tour(t);
  const avec = await vivreAvecReponses(SCENARIO.length);
  assert.deepEqual(avec.tours.map((t) => t.s.choixAFaire), sans.tours.map((t) => t.s.choixAFaire));
  assert.deepEqual(avec.tours.map((t) => t.s.automatiques.map((r) => [r.operation, r.statut])), sans.tours.map((t) => t.s.automatiques.map((r) => [r.operation, r.statut])));
  const ps = await sans.vecu(); const pa = await avec.vecu();
  assert.equal(ps.executions.length, pa.executions.length); assert.equal(ps.emissions.length, pa.emissions.length);
  assert.equal(ps.receptions.length, 0); assert.equal(pa.receptions.length, 5);
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f); if (r === 'app/langage/episodes-environnement.js' || r === 'app/langage/executions-vecues.js' || r === 'app/langage/environnement-conversation.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.83 : la vue est lue par executions-vecues.js (exécutions vécues) et ses constantes de nommage par environnement-conversation.js (acte prospectif d'émission)
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    assert.equal(/episodes-environnement|projeterEnvironnements|PREFIXE_ENVIRONNEMENT|ENTREE_EMISE/.test(code), false, r);
    assert.equal(/origine:\s*['"]experience['"]|ORIGINE_EXPERIENCE/.test(code), false, r);
  }
  assert.equal(VERSION_BASE, 22); assert.equal(SCHEMA_SAUVEGARDE, 12); assert.equal(TABLES.length, 26);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => d.nom.startsWith(PREFIXE_ENVIRONNEMENT)), false, 'aucun environnement dans le catalogue réel');
});
// === FIN_TEST_PROJECTION_ENVIRONNEMENT_FLUX ===
