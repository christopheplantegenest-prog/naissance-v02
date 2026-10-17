// v0.65.6 — AT-6 « MANUEL DE BOUT EN BOUT » (GO 17/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune acquisition.
// app/atelier/parcours.js : étapes DÉRIVÉES du journal AT-1 réel (chantier.js) et des pièces lues par les vrais vérificateurs (mission.js,
// verification.js, empreinte.js) ; aucune seconde machine d'état. Toutes les étapes et leurs gestes, abstention sur base indéfinie,
// demande de vérification tirée des pièces, cohérence pièces ↔ journal (chaque incohérence nommée), pureté.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/parcours.js';
import { cleTentative, tentativesDuJournal, etapeDe, proposerVersion, demandeDe, texteDemande, raisonPieces } from '../app/atelier/parcours.js';
import { ouvrirChantier, appliquer, etatDe } from '../app/atelier/chantier.js';
import { verifierRapport } from '../app/atelier/mission.js';
import { lireFaits, confronter } from '../app/atelier/verification.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { BASE, CANDIDAT, VERSION_BASE, CHANTIER, JALON, BRANCHE, MISSION, RAPPORT, RAPPORT_BLOQUE, DEMANDE, FAITS } from './atelier-aide.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(RACINE, 'app', 'atelier', 'parcours.js'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CONFORME = 'verification-technique-conforme';

let horloge = 0;
const quand = () => `2026-10-17T14:00:${String(horloge++ % 60).padStart(2, '0')}.000Z`;
function ouvert(jalons = [JALON], tentativesMax = 2) {
  return ouvrirChantier({ id: CHANTIER, objectif: 'TÉMOIN AT-6 — parcours MANUEL de bout en bout.', base: { sha: BASE, version: VERSION_BASE },
    plan: jalons.map((id) => ({ id, titre: 'Jalon témoin', critere: 'Le test témoin passe.', tentativesMax })) }, quand());
}
function ev(journal, type, donnees = {}) {
  const r = appliquer(journal, { type, quand: quand(), donnees });
  assert.ok(Array.isArray(r), r.raison);
  return r;
}
// Pièce lue, comme ecran.js la construit : rapport par verifierRapport, faits par lireFaits (empreinte vérifiée).
const lire = ({ mission, rapport = null, demande = null, faits = [] }) => ({
  mission, rapport: rapport === null ? null : { texte: rapport, lu: verifierRapport(mission, rapport) }, demande,
  faits: faits.map((t) => { const lu = lireFaits(t, hacherSha256); assert.equal(lu.raison, undefined); return { texte: t, lu }; }),
});
const verdictDe = (p) => confronter({ mission: p.mission, rapport: p.rapport.texte, faits: p.faits[p.faits.length - 1].texte, hacherSha256 }).verdict_technique;
const REF = (n = 1) => `${BRANCHE(n)}@${CANDIDAT}`;

// Scénario complet jusqu'à une étape donnée : { journal, pieces }.
function jusqua(etape, { issue = 'conforme', jalons = [JALON] } = {}) {
  let j = ev(ouvert(jalons), 'plan-approuve');
  if (etape === 'mission-a-lancer') return { journal: j, pieces: {} };
  j = ev(j, 'tentative-lancee', { jalon: JALON });
  const pieces = { [cleTentative(JALON, 1)]: lire({ mission: MISSION(1) }) };
  if (etape === 'rapport-attendu') return { journal: j, pieces };
  j = ev(j, 'tentative-rendue', { jalon: JALON, numero: 1, reference: REF() });
  pieces[cleTentative(JALON, 1)] = lire({ mission: MISSION(1), rapport: RAPPORT(1) });
  if (etape === 'demande-a-copier') return { journal: j, pieces };
  pieces[cleTentative(JALON, 1)] = lire({ mission: MISSION(1), rapport: RAPPORT(1), demande: DEMANDE() });
  if (etape === 'faits-attendus') return { journal: j, pieces };
  pieces[cleTentative(JALON, 1)] = lire({ mission: MISSION(1), rapport: RAPPORT(1), demande: DEMANDE(), faits: [FAITS({ issue })] });
  return { journal: j, pieces };
}
const etapeScenario = (s) => {
  const p = s.pieces[cleTentative(JALON, 1)];
  return etapeDe({ etat: etatDe(s.journal), pieces: s.pieces, verdict: p && p.faits.length ? verdictDe(p) : null });
};

// ------------------------------------------------------------------------------------------------ étapes et gestes
test('sans chantier, plan à approuver, arrêté, bloqué : étapes et seuls gestes permis', () => {
  assert.deepEqual(etapeDe({ etat: null }), { etape: 'chantier-a-ouvrir', jalon: null, numero: null, gestes: ['ouvrir'], consigne: 'Remplis le chantier, puis ouvre-le.' });
  assert.deepEqual(etapeDe({ etat: etatDe(ouvert()) }).gestes, ['approuver', 'arreter']);
  assert.equal(etapeDe({ etat: etatDe(ev(ouvert(), 'chantier-arrete', { motif: 'stop' })) }).etape, 'chantier-arrete');
  assert.deepEqual(etapeDe({ etat: etatDe(ev(ouvert(), 'chantier-arrete', { motif: 'stop' })) }).gestes, []);
  let j = ev(ouvert([JALON], 1), 'plan-approuve');
  j = ev(j, 'tentative-lancee', { jalon: JALON });
  j = ev(j, 'tentative-annulee', { jalon: JALON, numero: 1, motif: 'abandon' });
  const e = etapeDe({ etat: etatDe(j) });
  assert.equal(e.etape, 'chantier-bloque');
  assert.deepEqual(e.gestes, ['arreter']);
  assert.ok(Object.isFrozen(e) && Object.isFrozen(e.gestes));
});
test('mission à lancer : numéro = tentatives + 1 ; seuls générer, lancer, arrêter', () => {
  const e = etapeScenario(jusqua('mission-a-lancer'));
  assert.equal(e.etape, 'mission-a-lancer');
  assert.equal(e.jalon, JALON);
  assert.equal(e.numero, 1);
  assert.deepEqual(e.gestes, ['generer', 'lancer', 'arreter']);
});
test('tentative lancée : rapport attendu ; lancement ≠ génération (aucune nouvelle génération, aucun nouveau lancement)', () => {
  const e = etapeScenario(jusqua('rapport-attendu'));
  assert.equal(e.etape, 'rapport-attendu');
  assert.deepEqual(e.gestes, ['recopier-dossier', 'enregistrer', 'annuler', 'arreter']);
  for (const g of ['generer', 'lancer', 'confronter', 'accepter', 'refuser']) assert.equal(e.gestes.includes(g), false, g);
});
test('tentative vivante sans pièce (lancée avant AT-6) : aucune pièce inventée, seuls annuler et arrêter', () => {
  const s = jusqua('rapport-attendu');
  const e = etapeDe({ etat: etatDe(s.journal), pieces: {} });
  assert.equal(e.etape, 'tentative-sans-pieces');
  assert.deepEqual(e.gestes, ['annuler', 'arreter']);
});
test('candidat rendu : demande à copier, puis faits attendus', () => {
  assert.deepEqual(etapeScenario(jusqua('demande-a-copier')).gestes, ['copier-demande', 'annuler', 'arreter']);
  const f = etapeScenario(jusqua('faits-attendus'));
  assert.equal(f.etape, 'faits-attendus');
  assert.deepEqual(f.gestes, ['copier-demande', 'confronter', 'annuler', 'arreter']);
});
test('faits reçus : conforme => accepter et refuser ; non conforme => refuser seulement ; impossible => ni accepter ni refuser', () => {
  const c = etapeScenario(jusqua('faits', { issue: 'conforme' }));
  assert.equal(c.etape, 'decision-attendue');
  assert.deepEqual(c.gestes, ['copier-demande', 'confronter', 'accepter', 'refuser', 'arreter']);
  const nc = etapeScenario(jusqua('faits', { issue: 'non-conforme' }));
  assert.equal(nc.etape, 'decision-attendue');
  assert.deepEqual(nc.gestes, ['copier-demande', 'confronter', 'refuser', 'arreter']);
  const im = etapeScenario(jusqua('faits', { issue: 'impossible' }));
  assert.equal(im.etape, 'verification-a-refaire');
  assert.deepEqual(im.gestes, ['copier-demande', 'confronter', 'annuler', 'arreter']);
});
test('faits reçus sans verdict recalculé : TypeError (le parcours ne devine jamais un verdict)', () => {
  const s = jusqua('faits');
  for (const v of [null, undefined, 'conforme', 'verification-technique-acceptee']) assert.throws(() => etapeDe({ etat: etatDe(s.journal), pieces: s.pieces, verdict: v }), TypeError);
});
test('après un refus : tentative 2 à lancer ; après le dernier refus possible : bloqué', () => {
  const s = jusqua('faits', { issue: 'non-conforme' });
  let j = ev(s.journal, 'tentative-rejetee', { jalon: JALON, numero: 1, motif: 'non conforme' });
  const e = etapeDe({ etat: etatDe(j), pieces: s.pieces });
  assert.equal(e.etape, 'mission-a-lancer');
  assert.equal(e.numero, 2);
  j = ev(j, 'tentative-lancee', { jalon: JALON });
  j = ev(j, 'tentative-annulee', { jalon: JALON, numero: 2, motif: 'abandon' });
  assert.equal(etapeDe({ etat: etatDe(j) }).etape, 'chantier-bloque');
});
test('acceptation du dernier jalon : chantier terminé, aucun geste', () => {
  const s = jusqua('faits');
  const j = ev(s.journal, 'tentative-acceptee', { jalon: JALON, numero: 1, motif: 'ok' });
  const e = etapeDe({ etat: etatDe(j), pieces: s.pieces });
  assert.equal(e.etape, 'chantier-termine');
  assert.deepEqual(e.gestes, []);
  assert.match(e.consigne, /ni un dépôt sur main, ni une acquisition/);
});
test('jalon suivant après un candidat accepté non déposé : ABSTENTION (base indéfinie), aucune base inventée ; plan à 2 jalons non limité', () => {
  const s = jusqua('faits', { jalons: [JALON, 'temoin-2'] });
  assert.equal(etatDe(s.journal).plan.length, 2);
  const j = ev(s.journal, 'tentative-acceptee', { jalon: JALON, numero: 1, motif: 'ok' });
  const e = etapeDe({ etat: etatDe(j), pieces: s.pieces });
  assert.equal(e.etape, 'base-indefinie');
  assert.equal(e.jalon, 'temoin-2');
  assert.equal(e.numero, null);
  assert.deepEqual(e.gestes, ['arreter']);
  assert.match(e.consigne, /n'est pas définie/);
});

// ------------------------------------------------------------------------------------------------ demande de vérification
test('proposerVersion : patch suivant, une proposition ; X.Y.Z invalide refusé', () => {
  assert.equal(proposerVersion('0.65.5'), '0.65.6');
  assert.equal(proposerVersion('1.2.9'), '1.2.10');
  for (const v of ['0.65', '0.65.5.1', 'v0.65.5', '00.1.2', '', null]) assert.throws(() => proposerVersion(v), TypeError);
});
test('demandeDe : les cinq valeurs viennent des pièces (rapport enregistré + instantané lancé), version_candidat fournie', () => {
  const m = MISSION(1);
  const r = verifierRapport(m, RAPPORT(1)).rapport;
  const d = demandeDe({ mission: m, rapport: r, versionCandidat: '0.65.9' });
  assert.deepEqual(d, { branche: BRANCHE(1), candidat: CANDIDAT, base: BASE, version_base: VERSION_BASE, version_candidat: '0.65.9' });
  assert.ok(Object.isFrozen(d));
  assert.throws(() => demandeDe({ mission: m, rapport: verifierRapport(m, RAPPORT_BLOQUE(1)).rapport, versionCandidat: '0.65.6' }), TypeError);
  assert.throws(() => demandeDe({ mission: m, rapport: r, versionCandidat: '0.65' }), TypeError);
  assert.throws(() => demandeDe({ mission: m, rapport: r }), TypeError);
});
test('texteDemande : portée exacte de l\'autorisation, cinq lignes, version_candidat jamais présentée comme la version du candidat', () => {
  const t = texteDemande(DEMANDE());
  assert.match(t, /autorise UNIQUEMENT le run « Atelier — vérification technique » lancé depuis main avec exactement ces cinq valeurs/);
  assert.match(t, /aucun autre run, aucune branche, aucun push, rien sur main, aucun tag, aucun dépôt/);
  for (const [k, v] of Object.entries(DEMANDE())) assert.ok(t.includes(`\n${k} = ${v}\n`), k);
  assert.match(t, /ce n'est pas la version du candidat/);
  assert.ok(t.endsWith('\n'));
});
test('tentativesDuJournal : numéros par jalon (comme AT-1), rendue et décision rattachées', () => {
  const s = jusqua('faits');
  const j = ev(s.journal, 'tentative-rejetee', { jalon: JALON, numero: 1, motif: 'non', candidat: CANDIDAT, faits: 'x', verdict: CONFORME });
  const l = tentativesDuJournal(ev(j, 'tentative-lancee', { jalon: JALON }));
  assert.deepEqual(l.map((t) => [t.jalon, t.numero, t.rendue && t.rendue.reference, t.decision && t.decision.type]), [[JALON, 1, REF(), 'tentative-rejetee'], [JALON, 2, null, null]]);
});

// ------------------------------------------------------------------------------------------------ cohérence pièces ↔ journal
const coherence = (s, piecesDepuis = 1) => raisonPieces({ etat: etatDe(s.journal), journal: s.journal, pieces: s.pieces, piecesDepuis });
test('cohérence : chaque étape réelle est cohérente', () => {
  for (const e of ['mission-a-lancer', 'rapport-attendu', 'demande-a-copier', 'faits-attendus', 'faits']) assert.equal(coherence(jusqua(e)), null, e);
});
test('cohérence : pièce orpheline, tentative sans pièce, début des pièces', () => {
  const s = jusqua('rapport-attendu');
  assert.match(coherence({ ...s, pieces: { ...s.pieces, [cleTentative(JALON, 2)]: s.pieces[cleTentative(JALON, 1)] } }), /pièce « temoin-1\/2 » sans tentative lancée/);
  assert.match(coherence({ ...s, pieces: {} }), /tentative « temoin-1\/1 » sans sa pièce/);
  // Tentative écrite AVANT le début des pièces (copie AT-4) : exemptée, jamais complétée.
  assert.equal(coherence({ ...s, pieces: {} }, s.journal.length + 1), null);
  assert.match(raisonPieces({ etat: etatDe(s.journal), journal: s.journal, pieces: s.pieces, piecesDepuis: 0 }), /début des pièces/);
  assert.match(raisonPieces({ etat: etatDe(s.journal), journal: s.journal, pieces: [], piecesDepuis: 1 }), /pièces illisibles/);
});
test('cohérence : instantané étranger (numéro, jalon, base) refusé', () => {
  const s = jusqua('rapport-attendu');
  const k = cleTentative(JALON, 1);
  for (const m of [MISSION(2), MISSION(1, { base: { sha: 'd'.repeat(40), version: VERSION_BASE } }), MISSION(1, { chantier: 'autre' }), MISSION(1, { jalon: { id: 'temoin-2', titre: 'x', comportement: 'y' } })]) {
    assert.match(coherence({ ...s, pieces: { [k]: lire({ mission: m }) } }), /instantané étranger/);
  }
});
test('cohérence : rapport présent sans rendue, absent avec rendue, non conforme, référence différente', () => {
  const k = cleTentative(JALON, 1);
  const lancee = jusqua('rapport-attendu');
  assert.match(coherence({ ...lancee, pieces: { [k]: lire({ mission: MISSION(1), rapport: RAPPORT(1) }) } }), /présent pour une tentative non rendue/);
  const rendue = jusqua('demande-a-copier');
  assert.match(coherence({ ...rendue, pieces: { [k]: lire({ mission: MISSION(1) }) } }), /absent pour une tentative rendue/);
  assert.match(coherence({ ...rendue, pieces: { [k]: lire({ mission: MISSION(1), rapport: '{' }) } }), /rapport enregistré non conforme/);
  assert.match(coherence({ ...rendue, pieces: { [k]: lire({ mission: MISSION(1), rapport: RAPPORT_BLOQUE(1) }) } }), /rapport enregistré non conforme/);
  assert.match(coherence({ ...rendue, pieces: { [k]: lire({ mission: MISSION(1), rapport: RAPPORT(1, { candidat: { branche: BRANCHE(1), sha: 'e'.repeat(40) } }) }) } }), /référence rendue différente du rapport/);
});
test('cohérence : demande étrangère aux pièces, faits sans demande, faits d\'une autre demande', () => {
  const k = cleTentative(JALON, 1);
  const s = jusqua('faits-attendus');
  for (const d of [DEMANDE(1, 'e'.repeat(40)), { ...DEMANDE(), base: 'd'.repeat(40) }, { ...DEMANDE(), branche: BRANCHE(2) }, { ...DEMANDE(), version_base: '0.65.4' }, { ...DEMANDE(), extra: 1 }]) {
    assert.match(coherence({ ...s, pieces: { [k]: lire({ mission: MISSION(1), rapport: RAPPORT(1), demande: d }) } }), /demande étrangère/, JSON.stringify(d));
  }
  assert.match(coherence({ ...s, pieces: { [k]: lire({ mission: MISSION(1), rapport: RAPPORT(1), faits: [FAITS()] }) } }), /faits sans demande copiée/);
  assert.match(coherence({ ...s, pieces: { [k]: lire({ mission: MISSION(1), rapport: RAPPORT(1), demande: DEMANDE(), faits: [FAITS({ demande: DEMANDE(1, CANDIDAT, '0.65.7') })] }) } }), /faits d'une autre demande/);
});
test('cohérence : une décision cite les faits réellement reçus, le candidat du rapport et un verdict compatible', () => {
  const s = jusqua('faits');
  const p = s.pieces[cleTentative(JALON, 1)];
  const empreinte = p.faits[0].lu.faits.empreinte;
  const decider = (type, d) => coherence({ ...s, journal: ev(s.journal, type, { jalon: JALON, numero: 1, motif: 'm', candidat: CANDIDAT, faits: empreinte, verdict: CONFORME, ...d }) });
  assert.equal(decider('tentative-acceptee', {}), null);
  assert.equal(decider('tentative-rejetee', { verdict: 'verification-technique-non-conforme' }), null);
  assert.match(decider('tentative-acceptee', { faits: '0'.repeat(64) }), /empreinte citée par la décision absente/);
  assert.match(decider('tentative-acceptee', { candidat: 'e'.repeat(40) }), /candidat cité par la décision différent/);
  assert.match(decider('tentative-acceptee', { verdict: 'verification-technique-non-conforme' }), /acceptation citant un verdict non conforme/);
  assert.match(decider('tentative-rejetee', { verdict: 'verification-impossible' }), /refus sans verdict exploitable/);
});
test('pureté : exports exacts, aucun import, ni horloge, ni hasard, ni stockage, ni réseau, ni asynchronisme', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['cleTentative', 'demandeDe', 'etapeDe', 'proposerVersion', 'raisonPieces', 'tentativesDuJournal', 'texteDemande']);
  for (const m of [/\bimport\b/, /\brequire\(/, /\bDate\b/, /Math\.random/, /localStorage/, /\bfetch\b/, /\basync\b/, /\bawait\b/, /\bdocument\b/, /globalThis/, /\bAUTO\b/, /https?:/]) assert.equal(m.test(CODE), false, String(m));
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
});
