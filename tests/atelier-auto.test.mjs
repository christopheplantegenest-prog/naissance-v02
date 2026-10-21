// v0.65.9 — AT-8.1 « AUTO À BLANC » (GO 18/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune acquisition de Naissance.
// Identité T, demande AUTO, lancement AUTO (tentative AT-1 + engagement AT-2 en une écriture), garde J1 (premier run seulement, essai 1,
// historique complet et frais, état durable exact, budget), frontière J2 (approbation, sonde d'écriture refusée, PRET_A_APPELER sans
// appel), faits AUTO, clôture à coût 0, incertain = engagement ouvert et jamais réémis, MANUEL / OFF / restauration inchangés,
// et frontières statiques : aucun réseau, aucun secret, aucune dépendance de modèle, aucun import cognitif.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as AUTO from '../app/atelier/auto.js';
import { canonique, etatDurableDe, ecrireEtatDurable, decouper, lireEtatDurable } from '../app/atelier/journal.js';
import { appliquerBudget, etatBudget } from '../app/atelier/budget.js';
import { construireMission } from '../app/atelier/mission.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { raisonPieces, tentativesDuJournal, etapeDe } from '../app/atelier/parcours.js';
import { etatDe } from '../app/atelier/chantier.js';
import { lirePieces } from '../app/atelier/journal.js';
import { executer as executerGarde, VARIABLES } from '../outils-atelier/auto-garde.mjs';
import { executer as executerFrontiere } from '../outils-atelier/auto-frontiere.mjs';
import { monterEcran, confirmerSauvegarde, conduire, BASE } from './atelier-aide.mjs';

const { identiteT, nomRun, groupeConcurrence, lireAppel, estimationMax, texteDemandeAuto, lireDemandeAuto, garder, frontiere, lireFaitsAuto, lireSonde, millisecondes } = AUTO;
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sansCommentaires = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const CH = 'temoin-atelier';
const J = 'temoin-1';
const T1 = `${CH}/${J}/1`;
const COMMIT = 'e'.repeat(40);
const RUN = '5000';
const SONDE_OK = { code: 1, sortie: 'HTTP/2.0 403 Forbidden\nContent-Type: application/json\n\n{"message":"Resource not accessible by integration","status":"403"}\ngh: Resource not accessible by integration (HTTP 403)\n' };
const APPROUVE = [{ state: 'approved', comment: '', environments: [{ name: 'atelier-auto' }], user: { login: 'christopheplantegenest-prog' } }];

// Chantier TÉMOIN conduit en mode AUTO par les VRAIS gestes de l'écran : 'en-cours', 'genere', 'lancee', 'sauvegardee'.
async function conduireAuto(jusqua = 'sauvegardee', { budget = {} } = {}) {
  const a = monterEcran({ version: '0.65.5' });
  await a.cliquer('mode-auto');
  await a.cliquer('temoin');
  a.saisir('sha', BASE);
  for (const [k, v] of Object.entries(budget)) if (k !== 'plafond-chantier') a.saisir(k, v);
  await a.cliquer('ouvrir');
  await a.cliquer('ouvrir-cycle');
  if (budget['plafond-chantier']) a.saisir('plafond-chantier', budget['plafond-chantier']);
  await a.cliquer('plafonner');
  await a.cliquer('approuver');
  if (jusqua === 'en-cours') return a;
  await a.cliquer('generer');
  await a.cliquer('auto-temoin');
  if (jusqua === 'genere') return a;
  await a.cliquer('lancer-auto');
  if (jusqua === 'lancee') return a;
  await confirmerSauvegarde(a, COMMIT);
  return a;
}
let memo = null;
async function base() { if (!memo) { const a = await conduireAuto(); memo = { a, copie: a.copie() }; } return structuredClone(memo.copie); }

// Entrées d'une garde sur un état durable (texte canonique) : tête = commit demandé, empreinte exacte, premier run de T.
const quandLancement = (copie) => copie.journal.find((e) => e.type === 'tentative-lancee').quand;
function scenario(copie, patch = {}) {
  const texte = patch.texte ?? canonique(etatDurableDe(copie));
  const entrees = { chantier: CH, jalon: J, numero: '1', commit: COMMIT, empreinte: hacherSha256(texte), ...patch.entrees };
  const contexte = { run_id: RUN, run_attempt: '1', workflow_sha: 'f'.repeat(40), ref: 'refs/heads/main', ...patch.contexte };
  const runs = patch.runs ?? [{ id: Number(RUN), display_title: nomRun(T1), run_attempt: 1, created_at: patch.creation ?? '2026-10-17T16:00:00Z' }];
  const historique = patch.historique === undefined ? { total: patch.total ?? runs.length, runs } : patch.historique;
  const journal = patch.journal ?? { tete: COMMIT, texte };
  return { entrees, contexte, historique, journal };
}
const raisonGarde = (copie, patch) => garder(scenario(copie, patch)).raison;

// ------------------------------------------------------------------------------------------------ identité T
test('identité T : chantier/jalon/numero stricts ; nom du run et groupe de concurrence en dérivent ; rien d\'aléatoire', () => {
  assert.deepEqual({ ...identiteT({ chantier: CH, jalon: J, numero: '1' }) }, { t: T1, chantier: CH, jalon: J, numero: 1 });
  assert.equal(identiteT({ chantier: CH, jalon: J, numero: 3 }).t, `${CH}/${J}/3`);
  assert.equal(identiteT({ chantier: CH, jalon: J, numero: '999' }).t, `${CH}/${J}/999`);
  const invalides = [{ chantier: 'Temoin', jalon: J, numero: '1' }, { chantier: 'a/b', jalon: J, numero: '1' }, { chantier: '', jalon: J, numero: '1' },
    { chantier: CH, jalon: 'j 1', numero: '1' }, { chantier: CH, jalon: '-j', numero: '1' }, { chantier: 'a'.repeat(41), jalon: J, numero: '1' },
    { chantier: CH, jalon: J, numero: '01' }, { chantier: CH, jalon: J, numero: '0' }, { chantier: CH, jalon: J, numero: '1000' }, { chantier: CH, jalon: J, numero: 1.5 },
    { chantier: CH, jalon: J, numero: ' 1' }, { chantier: CH, jalon: J, numero: '1\n' }, { chantier: CH, jalon: J }, {}];
  for (const x of invalides) assert.deepEqual(identiteT(x), { raison: 'tentative-invalide' }, JSON.stringify(x));
  assert.equal(identiteT({ chantier: 'a'.repeat(40), jalon: J, numero: '1' }).t.length, 40 + J.length + 3);
  assert.equal(nomRun(T1), `atelier-auto ${T1}`);
  assert.equal(groupeConcurrence(T1), `atelier-auto/${T1}`);
});

// ------------------------------------------------------------------------------------------------ appel prévu, estimation
test('appel prévu : clés exactes, appels = 1 seulement, bornes ; estimation maximale en microdollars arrondie vers le haut', () => {
  const a = { modele: 'a-blanc', entree_max: 20000, max_tokens: 1000, tarif_entree: 1000000, tarif_sortie: 5000000, appels: 1 };
  assert.deepEqual({ ...lireAppel(a) }, a);
  assert.equal(estimationMax(a), 25000);
  assert.equal(estimationMax({ ...a, entree_max: 1, max_tokens: 1, tarif_entree: 1, tarif_sortie: 1 }), 2);
  assert.equal(estimationMax({ ...a, entree_max: 1000000 / 1000, tarif_entree: 1000, max_tokens: 1, tarif_sortie: 1000000 }), 1 + 1);
  assert.equal(estimationMax({ ...a, entree_max: 200000, tarif_entree: 1000000000, max_tokens: 64000, tarif_sortie: 1000000000 }), 264000000); // 200 USD + 64 USD
  assert.equal(lireAppel({ ...a, appels: 2 }).raison, 'appels-different-de-1');
  assert.equal(lireAppel({ ...a, appels: 0 }).raison, 'appels-different-de-1');
  for (const x of [{ ...a, modele: 'A' }, { ...a, modele: '' }, { ...a, entree_max: 0 }, { ...a, entree_max: 200001 }, { ...a, max_tokens: 64001 }, { ...a, max_tokens: 1.5 },
    { ...a, tarif_entree: 0 }, { ...a, tarif_sortie: 1000000001 }, { ...a, extra: 1 }, (({ modele, ...r }) => r)(a), null]) assert.equal(lireAppel(x).raison, 'appel-invalide', JSON.stringify(x));
  assert.equal(lireAppel({ ...a, entree_max: 200000, max_tokens: 64000, tarif_entree: 1000000000, tarif_sortie: 1000000000 }).raison, undefined);
  assert.throws(() => estimationMax({ ...a, appels: 2 }), /appels-different-de-1/);
});

// ------------------------------------------------------------------------------------------------ demande AUTO
test('demande AUTO : déterministe, relue strictement, portée exacte ; aucune valeur hors de T, commit et empreinte', () => {
  const d = { chantier: CH, jalon: J, numero: 1, commit: COMMIT, empreinte: 'a'.repeat(64) };
  const t = texteDemandeAuto(d);
  assert.equal(t, texteDemandeAuto({ ...d, numero: '1' }));
  assert.match(t, /autorise UNIQUEMENT UN déclenchement du workflow « Atelier — AUTO à blanc » \(atelier-auto\.yml\), depuis main/);
  assert.match(t, /aucune relance, aucun second déclenchement, aucun appel de modèle, aucun secret/);
  assert.deepEqual(t.split('\n').filter((l) => / = /.test(l)), ['protocole = atelier-auto-demande-1', `chantier = ${CH}`, `jalon = ${J}`, 'numero = 1', `commit = ${COMMIT}`, `empreinte = ${'a'.repeat(64)}`]);
  assert.deepEqual({ ...lireDemandeAuto(t).demande }, { t: T1, chantier: CH, jalon: J, numero: 1, commit: COMMIT, empreinte: 'a'.repeat(64) });
  assert.match(lireDemandeAuto(`${t}numero = 2\n`).raison, /en double/);
  assert.match(lireDemandeAuto(t.replace(/^commit = .*$/m, '')).raison, /absente/);
  assert.equal(lireDemandeAuto(t.replace('numero = 1', 'numero = 01')).raison, 'tentative-invalide');
  assert.equal(lireDemandeAuto(t.replace(COMMIT, 'E'.repeat(40))).raison, 'demande-invalide');
  assert.equal(lireDemandeAuto(t.replace('atelier-auto-demande-1', 'atelier-auto-demande-2')).raison, 'protocole inconnu');
  assert.throws(() => texteDemandeAuto({ ...d, commit: 'x' }), TypeError);
  assert.throws(() => texteDemandeAuto({ ...d, jalon: 'J' }), TypeError);
});

// ------------------------------------------------------------------------------------------------ écran : lancement AUTO
test('lancement AUTO : UNE écriture = tentative AT-1 (mode AUTO, appel) + instantané + engagement AT-2 de T à l\'estimation', async () => {
  const a = await conduireAuto('genere');
  assert.match(a.un('auto-estimation').textContent, /: 0,025 USD — appels autorisés : 1\.$/);
  const avant = a.stockage.ecritures;
  await a.cliquer('lancer-auto');
  assert.equal(a.stockage.ecritures, avant + 1);
  const c = a.copie();
  const ev = c.journal.at(-1);
  assert.equal(ev.type, 'tentative-lancee');
  assert.deepEqual(ev.donnees, { jalon: J, mode: 'AUTO', appel: { modele: 'a-blanc', entree_max: 20000, max_tokens: 1000, tarif_entree: 1000000, tarif_sortie: 5000000, appels: 1 } });
  assert.deepEqual(c.registre.at(-1).donnees, { execution: T1, chantier: CH, maximum: 25000 });
  assert.deepEqual(Object.keys(c.pieces), [`${J}/1`]);
  assert.deepEqual(c.pieces[`${J}/1`].mission, c.mission);
  assert.equal(etatBudget(c.registre).executions[T1].statut, 'engagee');
  assert.deepEqual(a.copies, []); // aucun presse-papiers
  assert.deepEqual(tentativesDuJournal(c.journal).map((t) => t.mode), ['AUTO']);
  assert.equal(etapeDe({ etat: etatDe(c.journal), pieces: lirePieces(c.pieces, c.piecesDepuis), journal: c.journal }).etape, 'auto-lancee');
});
test('lancement AUTO refusé (budget insuffisant, réserve, plafond du chantier, plafond par exécution, appel invalide) : rien n\'est écrit', async () => {
  for (const [budget, motif] of [[{ 'plafond-run': '0,02' }, /engagement refusé \(run\)/], [{ reserve: '99,98' }, /engagement refusé \(cycle\)/], [{ 'plafond-chantier': '0,024999' }, /engagement refusé \(chantier\)/]]) {
    const a = await conduireAuto('genere', { budget });
    const avant = a.stockage.getItem('naissance-ia.atelier.v1');
    const n = a.stockage.ecritures;
    await a.cliquer('lancer-auto');
    assert.match(a.un('message').textContent, motif, JSON.stringify(budget));
    assert.equal(a.stockage.ecritures, n);
    assert.equal(a.stockage.getItem('naissance-ia.atelier.v1'), avant);
  }
  const egal = await conduireAuto('genere', { budget: { 'plafond-chantier': '0,025' } }); // égalité exacte : permise
  await egal.cliquer('lancer-auto');
  assert.equal(egal.copie().journal.at(-1).type, 'tentative-lancee');
  const b = await conduireAuto('genere');
  b.saisir('auto-max-tokens', '64001');
  const n = b.stockage.ecritures;
  await b.cliquer('lancer-auto');
  assert.match(b.un('message').textContent, /appel prévu refusé \(appel-invalide\)/);
  assert.equal(b.copie().journal.at(-1).type, 'plan-approuve');
  b.saisir('auto-max-tokens', '1000');
  assert.equal(b.stockage.ecritures, n + 1); // la frappe est un brouillon enregistré ; le lancement refusé n'a rien écrit
});
test('demande AUTO copiable seulement après une sauvegarde confirmée À JOUR qui contient le lancement (D3) ; texte = texteDemandeAuto', async () => {
  const a = await conduireAuto('lancee');
  assert.equal(a.un('copier-demande-auto').disabled, true);
  assert.equal(a.trouver('auto-d3').length, 1);
  for (const f of a.un('copier-demande-auto').listeners.click) await f();
  assert.deepEqual(a.copies, []);
  await confirmerSauvegarde(a, COMMIT);
  assert.equal(a.un('copier-demande-auto').disabled, false);
  await a.cliquer('copier-demande-auto');
  const { empreinte } = ecrireEtatDurable(a.copie());
  assert.deepEqual(a.copies, [texteDemandeAuto({ chantier: CH, jalon: J, numero: 1, commit: COMMIT, empreinte })]);
  assert.match(a.un('portee-demande-auto').textContent, /UNIQUEMENT UN déclenchement/);
  // Sauvegarde confirmée qui contient le lancement mais désigne un AUTRE état que l'état actuel : demande non copiable.
  const c = a.copie();
  c.sauvegarde = { ...c.sauvegarde, empreinte: 'a'.repeat(64) };
  const s = (await import('./atelier-aide.mjs')).stockageMemoire(JSON.stringify(c));
  const b = monterEcran({ version: '0.65.5', stockage: s });
  await b.cliquer('mode-auto');
  assert.equal(b.un('copier-demande-auto').disabled, true);
  for (const f of b.un('copier-demande-auto').listeners.click) await f();
  assert.deepEqual(b.copies, []);
  assert.equal(a.trouver('enregistrer').length + a.trouver('recopier-dossier').length + a.trouver('copier-demande').length, 0); // aucun geste MANUEL
});

// ------------------------------------------------------------------------------------------------ J1 garde
test('garde J1 : premier run de T sur l\'état durable exact => AUTORISE ; faits canoniques, ASCII, appel_emis = false', async () => {
  const c = await base();
  const r = garder(scenario(c));
  assert.equal(r.autorise, true);
  assert.equal(r.raison, null);
  assert.equal(r.texte, canonique(r.faits));
  assert.match(r.texte, /^[\x20-\x7e\n]+$/);
  const f = r.faits;
  assert.deepEqual([f.protocole, f.tentative, f.etape, f.resultat, f.appel_emis, f.frontiere], ['atelier-auto-faits-1', T1, 'garde', 'autorise', false, null]);
  assert.deepEqual(f.provenance, { ref: 'refs/heads/main', run_attempt: '1', run_id: RUN, workflow_sha: 'f'.repeat(40) });
  assert.deepEqual(f.appel, { modele: 'a-blanc', entree_max: 20000, max_tokens: 1000, tarif_entree: 1000000, tarif_sortie: 5000000, appels: 1, estimation: 25000, engagement: 25000 });
  assert.deepEqual(f.etat, { commit: COMMIT, empreinte: scenario(c).entrees.empreinte });
  assert.deepEqual(lireFaitsAuto(r.texte).faits, f);
  assert.deepEqual(lireFaitsAuto(r.texte.slice(0, -1)).faits, f);
  assert.deepEqual(garder(scenario(c)), r); // déterministe
  // Un run POSTÉRIEUR du même T ne gêne pas le premier ; c'est lui qui sera refusé.
  const runs = [{ id: 5001, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T16:01:00Z' }, { id: 5000, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' }];
  assert.equal(raisonGarde(c, { runs }), null);
  assert.equal(raisonGarde(c, { runs, contexte: { run_id: '5001' } }), 'execution-anterieure');
});
test('garde J1 : run antérieur du même T (quel que soit son sort), essai > 1, historique absent, incomplet ou d\'un autre nom => REFUS', async () => {
  const c = await base();
  const moi = { id: 5000, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' };
  assert.equal(raisonGarde(c, { runs: [moi, { ...moi, id: 4999 }] }), 'execution-anterieure');
  assert.equal(raisonGarde(c, { runs: [moi, { ...moi, id: 1, run_attempt: 3 }] }), 'execution-anterieure');
  assert.equal(raisonGarde(c, { runs: [moi, { ...moi, id: 4999, display_title: nomRun(`${CH}/${J}/2`) }] }), null); // autre T : sans effet
  assert.equal(raisonGarde(c, { runs: [moi, { ...moi, id: 4999, display_title: `${nomRun(T1)} ` }] }), null); // nom exact seulement
  assert.equal(raisonGarde(c, { contexte: { run_attempt: '2' } }), 'essai-different-de-1');
  assert.equal(raisonGarde(c, { contexte: { run_attempt: '' } }), 'essai-different-de-1');
  assert.equal(raisonGarde(c, { runs: [] , total: 0 }), 'historique-incomplet');
  assert.equal(raisonGarde(c, { total: 2 }), 'historique-incomplet');
  assert.equal(raisonGarde(c, { runs: [moi, moi], total: 2 }), 'historique-incomplet'); // doublon de pagination : un seul run réel
  assert.equal(raisonGarde(c, { historique: null }), 'historique-illisible');
  assert.equal(raisonGarde(c, { historique: { total: 1, runs: [{ ...moi, id: '5000' }] } }), 'historique-illisible');
  assert.equal(raisonGarde(c, { historique: { total: -1, runs: [moi] } }), 'historique-illisible');
  assert.equal(raisonGarde(c, { runs: [{ ...moi, display_title: nomRun(`${CH}/${J}/2`) }] }), 'nom-de-run-different');
  assert.equal(raisonGarde(c, { contexte: { ref: 'refs/heads/atelier/x' } }), 'ref-non-main');
  assert.equal(raisonGarde(c, { contexte: { run_id: 'abc' } }), 'contexte-invalide');
  assert.equal(raisonGarde(c, { entrees: { numero: '01' } }), 'tentative-invalide');
  assert.equal(raisonGarde(c, { entrees: { commit: 'E'.repeat(40) } }), 'demande-invalide');
  assert.equal(raisonGarde(c, { entrees: { empreinte: 'a'.repeat(63) } }), 'demande-invalide');
  const ordre = scenario(c, { contexte: { run_attempt: '2' }, runs: [moi, { ...moi, id: 1 }] });
  assert.equal(garder(ordre).raison, 'essai-different-de-1'); // l'essai est refusé avant même la lecture de l'historique
});
test('garde J1 : fraîcheur — lancement de plus de 7 jours, dans le futur de plus d\'un jour, ou date illisible => REFUS ; bornes exactes permises', async () => {
  const c = await base();
  const q = millisecondes(quandLancement(c));
  const iso = (ms) => new Date(ms).toISOString();
  assert.equal(raisonGarde(c, { creation: iso(q + AUTO.FRAICHEUR_MS) }), null);
  assert.equal(raisonGarde(c, { creation: iso(q + AUTO.FRAICHEUR_MS + 1) }), 'demande-perimee');
  assert.equal(raisonGarde(c, { creation: iso(q - AUTO.AVANCE_MS) }), null);
  assert.equal(raisonGarde(c, { creation: iso(q - AUTO.AVANCE_MS - 1) }), 'date-future');
  assert.equal(raisonGarde(c, { creation: '2026-10-17 16:00:00' }), 'date-illisible');
  assert.equal(raisonGarde(c, { runs: [{ id: 5000, display_title: nomRun(T1), run_attempt: 1 }] }), 'date-illisible');
  for (const d of ['2026-10-17T16:00:00Z', '2026-10-17T16:00:00.5Z', '2024-02-29T23:59:59.999Z', '1970-01-01T00:00:00Z', '2000-03-01T00:00:00Z']) assert.equal(millisecondes(d), Date.parse(d), d);
  for (const d of ['2026-02-29T00:00:00Z', '2026-13-01T00:00:00Z', '2026-04-31T00:00:00Z', '2026-10-17T24:00:00Z', '2026-10-17T16:00:00+00:00', '2026-10-17T16:00:60Z', 'x', 7]) assert.equal(millisecondes(d), null, String(d));
});
test('garde J1 : état durable — branche absente, tête différente, empreinte fausse, état illisible, autre chantier => REFUS', async () => {
  const c = await base();
  assert.equal(raisonGarde(c, { journal: { tete: null, texte: null } }), 'journal-absent');
  assert.equal(raisonGarde(c, { journal: { tete: COMMIT, texte: null } }), 'journal-absent');
  assert.equal(raisonGarde(c, { journal: { tete: 'd'.repeat(40), texte: canonique(etatDurableDe(c)) } }), 'commit-different-de-la-tete');
  assert.equal(raisonGarde(c, { entrees: { empreinte: 'a'.repeat(64) } }), 'empreinte-differente');
  const casse = canonique(etatDurableDe(c)).replace('"piecesDepuis": 1', '"piecesDepuis": 9');
  assert.equal(raisonGarde(c, { texte: casse }), 'etat-illisible');
  assert.equal(raisonGarde(c, { texte: `${canonique(etatDurableDe(c))} ` }), 'etat-illisible');
  assert.equal(raisonGarde(c, { entrees: { chantier: 'autre-chantier' }, runs: [{ id: 5000, display_title: nomRun(`autre-chantier/${J}/1`), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' }] }), 'chantier-different');
});
test('garde J1 : tentative — absente, MANUEL, close (annulée ou chantier arrêté) ; appel invalide ou appels ≠ 1 => REFUS', async () => {
  const c = await base();
  const runs2 = [{ id: 5000, display_title: nomRun(`${CH}/${J}/2`), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' }];
  assert.equal(raisonGarde(c, { entrees: { numero: '2' }, runs: runs2 }), 'tentative-absente');
  const m = await conduire('lancee-sauvegardee', { budget: true });
  const cm = m.copie();
  const etm = canonique(etatDurableDe(cm));
  assert.equal(garder(scenario(cm, { texte: etm })).raison, 'tentative-non-auto');
  const ann = structuredClone(c);
  ann.journal.push({ n: ann.journal.length + 1, type: 'tentative-annulee', quand: '2026-10-17T15:30:00.000Z', donnees: { jalon: J, numero: 1, motif: 'Annulée.' } });
  assert.equal(raisonGarde(ann), 'tentative-close');
  const arr = structuredClone(c);
  arr.journal.push({ n: arr.journal.length + 1, type: 'chantier-arrete', quand: '2026-10-17T15:30:00.000Z', donnees: { motif: 'Arrêt.' } });
  assert.equal(raisonGarde(arr), 'tentative-close');
  const deux = structuredClone(c);
  deux.journal.find((e) => e.type === 'tentative-lancee').donnees.appel.appels = 2;
  assert.equal(raisonGarde(deux), 'appels-different-de-1');
  const sans = structuredClone(c);
  delete sans.journal.find((e) => e.type === 'tentative-lancee').donnees.appel;
  assert.equal(raisonGarde(sans), 'appel-invalide');
});
test('garde J1 : budget — registre absent ou suspendu, engagement absent, insuffisant, soldé, d\'un autre chantier => REFUS', async () => {
  const c = await base();
  const sansEng = c.registre.slice(0, -1);
  const avec = (registre) => ({ ...structuredClone(c), registre });
  const plus = (reg, type, donnees) => { const r = appliquerBudget(reg, { type, quand: '2026-10-17T15:10:00.000Z', donnees }); assert.ok(Array.isArray(r), JSON.stringify(r)); return r; };
  assert.equal(raisonGarde(avec(null)), 'registre-absent');
  assert.equal(raisonGarde(avec(sansEng)), 'engagement-absent');
  assert.equal(raisonGarde(avec(plus(sansEng, 'engagement', { execution: T1, chantier: CH, maximum: 24999 }))), 'engagement-insuffisant');
  assert.equal(raisonGarde(avec(plus(sansEng, 'engagement', { execution: T1, chantier: CH, maximum: 25001 }))), null);
  assert.equal(raisonGarde(avec(plus(c.registre, 'cout', { execution: T1, montant: 0 }))), 'engagement-solde');
  const susp = plus(plus(sansEng, 'engagement', { execution: 'x', chantier: CH, maximum: 1 }), 'cout', { execution: 'x', montant: 2 });
  assert.equal(raisonGarde(avec(plus(plus(sansEng, 'engagement', { execution: T1, chantier: CH, maximum: 25000 }), 'engagement', { execution: 'y', chantier: CH, maximum: 1 }))), null);
  assert.equal(etatBudget(susp).suspendu, true);
  assert.equal(raisonGarde(avec(susp)), 'registre-suspendu');
  const autre = plus(plus(sansEng, 'chantier-plafonne', { chantier: 'autre', plafond: 30000000 }), 'engagement', { execution: T1, chantier: 'autre', maximum: 25000 });
  assert.equal(raisonGarde(avec(autre)), 'engagement-autre-chantier');
  // Les plafonds sont déjà garantis par AT-2 au moment de l'engagement (rejeu) : la garde les reconstate sur l'état relu.
  const r = garder(scenario(avec(sansEng)));
  assert.equal(r.faits.appel.engagement, null);
  assert.equal(r.faits.resultat, 'refus');
});

// ------------------------------------------------------------------------------------------------ J2 frontière
test('frontière J2 : approbation atelier-auto + sonde refusée (403) + état inchangé => PRET_A_APPELER, aucun appel ; dossier exact', async () => {
  const c = await base();
  const s = scenario(c);
  const r = frontiere({ entrees: s.entrees, contexte: s.contexte, journal: s.journal, approbations: APPROUVE, sonde: SONDE_OK });
  assert.equal(r.pret, true);
  assert.equal(r.faits.resultat, 'pret-a-appeler');
  assert.equal(r.faits.etape, 'frontiere');
  assert.equal(r.faits.appel_emis, false);
  const dossier = construireMission(c.pieces[`${J}/1`].mission);
  assert.deepEqual(r.faits.frontiere, { approbation: { etat: 'approved', login: 'christopheplantegenest-prog' }, sonde: { statut: 403, conforme: true }, dossier_empreinte: hacherSha256(dossier), dossier_octets: Buffer.byteLength(dossier) });
  assert.deepEqual(lireFaitsAuto(r.texte).faits, r.faits);
  const ar = (patch) => frontiere({ entrees: s.entrees, contexte: s.contexte, journal: s.journal, approbations: APPROUVE, sonde: SONDE_OK, ...patch }).raison;
  assert.equal(ar({ approbations: [] }), 'approbation-absente');
  assert.equal(ar({ approbations: null }), 'approbation-illisible');
  assert.equal(ar({ approbations: [{ ...APPROUVE[0], environments: [{ name: 'github-pages' }] }] }), 'approbation-absente');
  assert.equal(ar({ approbations: [...APPROUVE, { ...APPROUVE[0], state: 'rejected' }] }), 'approbation-refusee');
  assert.equal(ar({ sonde: { code: 0, sortie: 'HTTP/2.0 201 Created\n{"sha":"x"}' } }), 'sonde-ecriture-acceptee');
  assert.equal(ar({ sonde: { code: 0, sortie: SONDE_OK.sortie } }), 'sonde-non-conforme');
  assert.equal(ar({ sonde: { code: 1, sortie: 'HTTP/2.0 404 Not Found\n' } }), 'sonde-non-conforme');
  assert.equal(ar({ sonde: { code: 1, sortie: 'HTTP/2.0 403 Forbidden\n{"message":"Bad credentials"}' } }), 'sonde-non-conforme');
  assert.equal(ar({ sonde: { code: 1, sortie: 'HTTP/2.0 404 Not Found\n{"message":"Resource not accessible by integration"}' } }), 'sonde-non-conforme');
  assert.equal(ar({ sonde: null }), 'sonde-non-conforme');
  assert.equal(ar({ contexte: { ...s.contexte, run_attempt: '2' } }), 'essai-different-de-1'); // relance de J2 seul
  assert.equal(ar({ journal: { tete: 'd'.repeat(40), texte: s.journal.texte } }), 'commit-different-de-la-tete'); // état avancé pendant l'attente
  assert.deepEqual(lireSonde({ code: 1, sortie: 'gh: Resource not accessible by integration (HTTP 403)' }), { statut: 403, conforme: true });
});

// ------------------------------------------------------------------------------------------------ faits AUTO
test('faits AUTO : altérés, non canoniques, d\'un autre protocole, appel émis, tentative illisible => refusés', async () => {
  const c = await base();
  const r = garder(scenario(c));
  assert.match(lireFaitsAuto(r.texte.replace('"autorise"', '"refus"')).raison, /empreinte/);
  assert.match(lireFaitsAuto(r.texte.replace(/\n "/g, '\n  "')).raison, /canonique/);
  assert.match(lireFaitsAuto(r.texte.slice(0, 200)).raison, /JSON illisible/);
  const re = (patch) => { const { empreinte, ...sans } = { ...r.faits, ...patch }; return canonique({ ...sans, empreinte: hacherSha256(canonique(sans)) }); };
  assert.equal(lireFaitsAuto(re({ appel_emis: true })).raison, 'appel-emis');
  assert.equal(lireFaitsAuto(re({ protocole: 'atelier-faits-3' })).raison, 'protocole inconnu');
  assert.equal(lireFaitsAuto(re({ tentative: 'a/b' })).raison, 'tentative illisible');
  assert.equal(lireFaitsAuto(re({ resultat: 'accepte' })).raison, 'étape ou résultat inconnu');
  assert.equal(lireFaitsAuto(re({ tentative: null })).faits.tentative, null);
  assert.equal(lireFaitsAuto('').raison, 'faits absents');
});

// ------------------------------------------------------------------------------------------------ écran : clôture, incertain, n+1
test('clôture AUTO : faits de CETTE tentative + motif => tentative annulée citant les faits et coût réel 0 ; sinon rien n\'est écrit', async () => {
  const a = await conduireAuto();
  const s = scenario(a.copie());
  const front = frontiere({ ...s, approbations: APPROUVE, sonde: SONDE_OK });
  const autreT = garder(scenario(a.copie(), { entrees: { numero: '2' }, runs: [{ id: 5000, display_title: nomRun(`${CH}/${J}/2`), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' }] }));
  const n = a.stockage.ecritures;
  for (const [faits, motif, attendu] of [[front.texte, '', /motif humain obligatoire/], [autreT.texte, 'm', /faits d'une autre tentative/], [front.texte.replace('pret-a-appeler', 'arret'), 'm', /empreinte/], ['{', 'm', /JSON illisible/]]) {
    a.saisir('faits-auto', faits);
    a.saisir('motif-auto', motif);
    await a.cliquer('clore-auto');
    assert.match(a.un('message').textContent, attendu);
    assert.equal(a.stockage.ecritures, n);
  }
  a.saisir('faits-auto', front.texte.slice(0, -1)); // sans saut de ligne final : accepté, conservé avec
  a.saisir('motif-auto', 'Témoin à blanc : PRET_A_APPELER, aucun appel.');
  await a.cliquer('clore-auto');
  assert.equal(a.stockage.ecritures, n + 1);
  const c = a.copie();
  assert.deepEqual(c.journal.at(-1).donnees, { jalon: J, numero: 1, motif: 'Témoin à blanc : PRET_A_APPELER, aucun appel.', mode: 'AUTO', faits_auto: front.texte, faits_auto_empreinte: front.faits.empreinte });
  assert.deepEqual(c.registre.at(-1).donnees, { execution: T1, montant: 0 });
  const b = etatBudget(c.registre);
  assert.deepEqual([b.executions[T1].statut, b.executions[T1].montant, b.engageCycle, b.consommeCycle], ['payee', 0, 0, 0]);
  assert.match(a.un(`auto-close-${J}-1`).textContent, /frontiere pret-a-appeler — run 5000/);
  assert.equal(lireEtatDurable(ecrireEtatDurable(c).texte).raison, undefined);
  assert.equal(raisonGarde(c), 'tentative-close'); // même T redéclenché après clôture : refusé
  assert.equal(etatDe(c.journal).plan[0].statut, 'a-faire'); // n+1 possible, par une décision humaine (nouveau lancement)
});
test('exécution incertaine : annuler sans faits laisse l\'engagement ouvert ; T n\'est jamais réémis ; n+1 = nouvelle identité et nouvel engagement', async () => {
  const a = await conduireAuto();
  assert.match(a.un('annuler-auto').textContent, /laisse son engagement ouvert/);
  a.saisir('motif-decision', 'Run perdu : issue inconnue.');
  await a.cliquer('annuler');
  let c = a.copie();
  assert.equal(c.journal.at(-1).type, 'tentative-annulee');
  assert.equal(etatBudget(c.registre).executions[T1].statut, 'engagee');
  assert.equal(appliquerBudget(c.registre, { type: 'cycle-ouvert', quand: 'x', donnees: { cycle: 'c2', plafond: 1, reserve: 0, plafondRun: 1 } }).limite, 'engagement-ouvert');
  assert.equal(raisonGarde(c), 'tentative-close');
  await a.cliquer('generer');
  await a.cliquer('lancer-auto');
  c = a.copie();
  assert.deepEqual(c.registre.at(-1).donnees, { execution: `${CH}/${J}/2`, chantier: CH, maximum: 25000 });
  assert.deepEqual(Object.keys(etatBudget(c.registre).executions).sort(), [T1, `${CH}/${J}/2`]);
  // Le run antérieur de T1 (refusé ou incertain) ne peut JAMAIS être suivi d'un second run autorisé de T1.
  const ancien = await base();
  assert.equal(raisonGarde(ancien, { runs: [{ id: 5000, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' }, { id: 4000, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T15:59:00Z' }] }), 'execution-anterieure');
});

// ------------------------------------------------------------------------------------------------ MANUEL, OFF, restauration
test('MANUEL inchangé : aucun geste AUTO, aucune section 11, tentatives sans « mode » ; AUTO jamais implicite', async () => {
  const m = await conduire('decide', { budget: true });
  assert.equal(m.un('mode').textContent, 'Mode : MANUEL');
  for (const n of ['lancer-auto', 'copier-demande-auto', 'clore-auto', 'auto-portee', 'auto-bandeau']) assert.equal(m.trouver(n).length, 0, n);
  assert.equal(m.zone.children.filter((x) => x.attrs['data-atelier-section'] === 'auto').length, 0);
  assert.deepEqual(tentativesDuJournal(m.copie().journal).map((t) => Object.keys(t).sort().join()), ['decision,jalon,n,numero,rendue']);
  assert.equal(m.copie().registre.some((e) => e.type === 'engagement' || e.type === 'cout'), false);
  const off = monterEcran({ version: '0.65.5' });
  assert.equal(off.un('mode').textContent, 'Mode : OFF');
  assert.equal(off.trouver('lancer-auto').length, 0);
  assert.equal(off.un('mode-auto').attrs['aria-pressed'], 'false');
});
test('OFF inchangé : une tentative AUTO vivante se consulte, aucun geste (même forcé) ; MANUEL ne la conduit pas', async () => {
  const a = await conduireAuto();
  await a.cliquer('mode-off');
  const avant = a.stockage.getItem('naissance-ia.atelier.v1');
  const n = a.stockage.ecritures;
  assert.equal(a.trouver('copier-demande-auto').length + a.trouver('clore-auto').length, 0);
  assert.equal(a.trouver('off-dossier').length, 1);
  for (const nom of ['annuler', 'arreter', 'preparer-sauvegarde']) for (const b of a.trouver(nom)) { assert.equal(b.disabled, true, nom); for (const f of b.listeners.click) await f(); }
  assert.equal(a.stockage.getItem('naissance-ia.atelier.v1'), avant);
  assert.equal(a.stockage.ecritures, n);
  await a.cliquer('mode-manuel');
  assert.equal(a.trouver('recopier-dossier').length + a.trouver('enregistrer').length + a.trouver('copier-demande-auto').length, 0);
  assert.match(a.un('dossier-auto').textContent, /Passe en mode AUTO/);
});
test('restauration d\'un état AUTO : installée en OFF (jamais AUTO) ; aperçu « auto-lancee » ; reprise en AUTO par un toucher explicite', async () => {
  const a = await conduireAuto();
  const parties = decouper(ecrireEtatDurable(a.copie()).texte, CH);
  const b = monterEcran({ version: '0.65.5' });
  await b.cliquer('mode-auto');
  for (const p of parties) { b.saisir('partie-restauration', p); await b.cliquer('ajouter-partie'); }
  assert.match(b.un('apercu-etape').textContent, /^Étape retrouvée : auto-lancee/);
  await b.cliquer('confirmer-restauration');
  assert.equal(b.copie().mode, 'OFF');
  assert.equal(b.un('mode').textContent, 'Mode : OFF');
  assert.equal(b.trouver('copier-demande-auto').length, 0);
  await b.cliquer('mode-auto');
  assert.equal(b.trouver('clore-auto').length, 1);
  assert.equal(b.un('copier-demande-auto').disabled, true); // aucune sauvegarde confirmée sur cet appareil : D3
});
test('cohérence des pièces : une tentative AUTO n\'est jamais rendue, n\'a ni rapport, ni demande, ni faits AT-5 ; mode inconnu refusé', async () => {
  const c = await base();
  const lues = lirePieces(c.pieces, c.piecesDepuis);
  const verif = (journal, pieces = lues) => raisonPieces({ etat: etatDe(journal), journal, pieces, piecesDepuis: 1 });
  assert.equal(verif(c.journal), null);
  const rendue = [...c.journal, { n: c.journal.length + 1, type: 'tentative-rendue', quand: 'x', donnees: { jalon: J, numero: 1, reference: `atelier/${CH}/${J}/1@${'c'.repeat(40)}` } }];
  assert.match(verif(rendue), /tentative AUTO rendue/);
  assert.match(verif(c.journal, { [`${J}/1`]: { ...lues[`${J}/1`], demande: {} } }), /tentative AUTO rendue, ou avec rapport, demande ou faits MANUEL/);
  const inconnu = structuredClone(c.journal);
  inconnu.find((e) => e.type === 'tentative-lancee').donnees.mode = 'auto';
  assert.match(verif(inconnu), /mode de lancement inconnu/);
  assert.equal(etapeDe({ etat: etatDe(c.journal), pieces: lues }).etape, 'rapport-attendu'); // sans journal : lecture AT-6 (journal.js), recalculée par l'écran
});

// ------------------------------------------------------------------------------------------------ outils J1 / J2 (fichiers déposés)
test('outils : auto-garde et auto-frontiere lisent les fichiers du workflow, écrivent faits.json et le résumé ; sorties 0 / 1', async () => {
  const c = await base();
  const texte = canonique(etatDurableDe(c));
  const d = mkdtempSync(join(tmpdir(), 'atelier-auto-'));
  try {
    const resume = join(d, 'resume.md');
    const env = { ATELIER_CHANTIER: CH, ATELIER_JALON: J, ATELIER_NUMERO: '1', ATELIER_COMMIT: COMMIT, ATELIER_EMPREINTE: hacherSha256(texte), GITHUB_RUN_ID: RUN, GITHUB_RUN_ATTEMPT: '1', GITHUB_WORKFLOW_SHA: 'f'.repeat(40), GITHUB_REF: 'refs/heads/main', GITHUB_STEP_SUMMARY: resume, GH_TOKEN: 'ne-doit-pas-etre-lu' };
    writeFileSync(join(d, 'tete.txt'), `${COMMIT}\n`);
    writeFileSync(join(d, 'chantier.json'), texte);
    writeFileSync(join(d, 'total.txt'), '1\n');
    writeFileSync(join(d, 'runs.jsonl'), `${JSON.stringify({ id: 5000, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' })}\n`);
    const g = executerGarde({ env, dossier: d });
    assert.deepEqual([g.code, g.ligne], [0, 'AUTORISE']);
    assert.equal(readFileSync(join(d, 'faits.json'), 'utf8'), g.texte);
    assert.match(readFileSync(resume, 'utf8'), /## Atelier AUTO à blanc — J1 garde : AUTORISE\n[\s\S]*```json\n\{\n "appel"/);
    assert.doesNotMatch(readFileSync(resume, 'utf8'), /ne-doit-pas-etre-lu/);
    const cli = spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-garde.mjs'), '--dossier', d], { env: { ...env, GITHUB_RUN_ATTEMPT: '2', GITHUB_STEP_SUMMARY: '' }, encoding: 'utf8' });
    assert.deepEqual([cli.status, cli.stdout], [1, 'REFUS essai-different-de-1\n']);
    writeFileSync(join(d, 'runs.jsonl'), '{pas du json\n');
    assert.equal(executerGarde({ env, dossier: d }).raison, 'historique-illisible');
    writeFileSync(join(d, 'approbations.json'), JSON.stringify(APPROUVE));
    writeFileSync(join(d, 'sonde-code.txt'), '1\n');
    writeFileSync(join(d, 'sonde-sortie.txt'), SONDE_OK.sortie);
    const f = executerFrontiere({ env, dossier: d });
    assert.deepEqual([f.code, f.ligne], [0, 'PRET_A_APPELER']);
    assert.match(readFileSync(resume, 'utf8'), /J2 frontière : PRET_A_APPELER \(aucun appel\)/);
    writeFileSync(join(d, 'sonde-code.txt'), '0\n');
    const cli2 = spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-frontiere.mjs'), '--dossier', d], { env: { ...env, GITHUB_STEP_SUMMARY: '' }, encoding: 'utf8' });
    assert.deepEqual([cli2.status, cli2.stdout], [1, 'ARRET sonde-non-conforme\n']);
    writeFileSync(join(d, 'tete.txt'), '');
    assert.equal(executerFrontiere({ env, dossier: d }).raison, 'journal-absent');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------------------------------------ frontières statiques
// Fermeture des imports relatifs d'un fichier (les modules node: sont rendus à part).
function fermeture(depart) {
  const vus = new Set();
  const node = new Set();
  const pile = [depart];
  while (pile.length) {
    const f = pile.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    const c = sansCommentaires(readFileSync(f, 'utf8'));
    for (const m of c.matchAll(/^\s*import\b[^;]*?from\s+'([^']+)'/gm)) {
      if (m[1].startsWith('node:')) node.add(m[1]);
      else { assert.match(m[1], /^\.\.?\//, `${f} -> ${m[1]}`); pile.push(resolve(dirname(f), m[1])); }
    }
  }
  return { fichiers: [...vus].map((f) => relative(RACINE, f)).sort(), node: [...node].sort() };
}
const INTERDITS = [/\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/, /https?:/, /\bimport\(/, /\brequire\(/, /\beval\(/, /new Function/, /anthropic/i, /x-api-key/i, /api[_-]?key/i, /secrets\./, /\bTOKEN\b|_TOKEN/, /child_process/, /node:(?:https?|http2|net|tls|dns|dgram|worker_threads|vm)\b/];
test('frontière J2 sans appel possible : fermeture des imports = atelier pur + node:fs/path/url ; aucun réseau, processus, secret ni clé', () => {
  const { fichiers, node } = fermeture(join(RACINE, 'outils-atelier', 'auto-frontiere.mjs'));
  assert.deepEqual(node, ['node:fs', 'node:path', 'node:url']);
  assert.deepEqual(fichiers, ['app/atelier/auto.js', 'app/atelier/budget.js', 'app/atelier/chantier.js', 'app/atelier/empreinte.js', 'app/atelier/journal.js', 'app/atelier/mission.js',
    'app/atelier/parcours.js', 'app/atelier/verification.js', 'outils-atelier/auto-frontiere.mjs', 'outils-atelier/auto-garde.mjs']);
  for (const f of fichiers) {
    const c = sansCommentaires(readFileSync(join(RACINE, f), 'utf8'));
    for (const m of INTERDITS) assert.equal(m.test(c), false, `${f} ${m}`);
  }
  assert.deepEqual(fermeture(join(RACINE, 'outils-atelier', 'auto-garde.mjs')).node, ['node:fs', 'node:path', 'node:url']);
});
test('variables d\'environnement : liste fermée lue une seule fois par outil ; aucune variable de jeton ; process.env seulement au lancement', () => {
  assert.deepEqual([...VARIABLES], ['ATELIER_CHANTIER', 'ATELIER_JALON', 'ATELIER_NUMERO', 'ATELIER_COMMIT', 'ATELIER_EMPREINTE', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKFLOW_SHA', 'GITHUB_REF', 'GITHUB_STEP_SUMMARY']);
  for (const n of ['auto-garde.mjs', 'auto-frontiere.mjs']) {
    const c = sansCommentaires(readFileSync(join(RACINE, 'outils-atelier', n), 'utf8'));
    assert.equal((c.match(/process\.env/g) || []).length, 1, n);
    assert.match(c, /executer\(\{ env: process\.env, dossier: process\.argv\[i \+ 1\] \}\)/, n);
    for (const v of c.matchAll(/\bv\.([A-Z_]+)/g)) assert.ok(VARIABLES.includes(v[1]), `${n} ${v[1]}`);
    assert.equal((c.match(/env\[/g) || []).length, n === 'auto-garde.mjs' ? 1 : 0, n); // la seule lecture : env[nom] pour nom de VARIABLES
    assert.doesNotMatch(c, /env\.[A-Z]/);
  }
});
test('auto.js : pur — imports de l\'atelier seulement, aucune horloge, aucun hasard, aucun stockage, aucun DOM, aucune entrée/sortie', () => {
  const c = sansCommentaires(readFileSync(join(RACINE, 'app', 'atelier', 'auto.js'), 'utf8'));
  assert.deepEqual([...c.matchAll(/^\s*import\b[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]).sort(), ['./budget.js', './chantier.js', './empreinte.js', './journal.js', './mission.js', './parcours.js']);
  for (const m of [/\bDate\b/, /Math\.random/, /\bsetTimeout\b/, /\bsetInterval\b/, /localStorage/, /indexedDB/, /\basync\b/, /\bawait\b/, /\bdocument\b/, /\bnavigator\b/, /\bglobalThis\b/, /\bwindow\b/, /\bprocess\b/, /performance\./, /\bcrypto\b/, ...INTERDITS]) assert.equal(m.test(c), false, String(m));
  assert.match(readFileSync(join(RACINE, 'app', 'atelier', 'auto.js'), 'utf8').split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  // MISE À JOUR DÉLIBÉRÉE v0.65.10 (AT-8.2) : + témoin, préparation, classement, faits de l'appel et du constat, décision de clôture (toujours purs).
  // MISE À JOUR DÉLIBÉRÉE v0.65.13 (AT-9.1) : + appel de développement (lecture, dossier, proposition) et candidat J4 (préparation, faits,
  // rapport), toujours purs ; la garde de pureté ci-dessus est inchangée. AT-9.2 : + extraits, fichiers transmis, remplacements exacts.
  // MISE À JOUR DÉLIBÉRÉE v0.65.16 (AT-10.5) : + lireRetourAuto (retour J2 + J4 d'un appel de développement), pure ; imports inchangés.
  assert.deepEqual(Object.keys(AUTO).sort(), ['AVANCE_MS', 'BORNES_APPEL', 'BORNES_DEVELOPPEMENT', 'BORNES_TEMOIN', 'EFFORTS', 'ENVIRONNEMENT', 'FRAICHEUR_MS', 'ISSUES', 'NOMS_RUN',
    'PROTOCOLE_CANDIDAT', 'PROTOCOLE_DEMANDE', 'PROTOCOLE_FAITS', 'PROTOCOLE_FAITS_TEMOIN', 'PROTOCOLE_FICHIERS', 'PROTOCOLE_PROPOSITION', 'PROTOCOLE_PROPOSITION_LUE', 'REF_MAIN',
    'appliquerRemplacements', 'cheminsDeveloppement', 'classerObservation', 'constater', 'corpsTemoin', 'coutReel', 'decisionCloture', 'dossierDeveloppement', 'empreinteProposition', 'estimationMax', 'faitsAppel',
    'faitsCandidat', 'fichiersTransmis', 'frontiere', 'garder', 'groupeConcurrence', 'identiteT', 'lireAppel', 'lireDemandeAuto', 'lireDeveloppement', 'lireExtraitsTexte', 'lireFaitsAuto', 'lireFaitsCandidat', 'lireFichiersBase',
    'lireProposition', 'lireRetourAuto', 'lireSonde', 'lireTemoin', 'millisecondes', 'missionDeveloppement', 'nomRun', 'preparerAppel', 'preparerCandidat', 'rapportCandidat', 'reponseAttendue',
    'texteDemandeAuto', 'texteProposition', 'texteTemoin']);
});
test('aucune dépendance de modèle : package.json inchangé sur ce point ; aucun module de l\'atelier ni outil AUTO ne nomme un fournisseur', () => {
  const p = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys({ ...p.dependencies, ...p.devDependencies }).filter((d) => /anthropic|openai|claude/i.test(d)), []);
  for (const f of ['app/atelier/auto.js', 'app/atelier/ecran.js', 'app/atelier/parcours.js', 'outils-atelier/auto-garde.mjs', 'outils-atelier/auto-frontiere.mjs']) {
    assert.doesNotMatch(readFileSync(join(RACINE, f), 'utf8'), /anthropic|api\.anthropic|x-api-key|claude-[a-z]+-[0-9]|secrets\./i, f);
  }
});
