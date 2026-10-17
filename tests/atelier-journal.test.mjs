// v0.65.7 — AT-7 « JOURNAL GIT + REPRISE » (GO 17/10/2026 ; D-007 précision D4). OUTILLAGE NON COGNITIF.
// app/atelier/journal.js, module PUR : forme canonique de l'état durable atelier-journal-1, lecture complète (AT-1, AT-2, pièces,
// empreintes, verdicts recalculés), extension autorisée, transport multiparties k/N (étude D2 : 20 000 caractères, 32 768 octets).
// Les états durables viennent d'un chantier témoin conduit par les VRAIS gestes de l'écran (tests/atelier-aide.mjs, conduire).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/journal.js';
import {
  canonique, etatDurableDe, ecrireEtatDurable, lireEtatDurable, comparerEtats, decouper, lirePartie, assemblerParties, preparerRestauration,
  texteConfirmation, lireConfirmation, brancheJournal, octetsUtf8, LIMITE_CARACTERES, LIMITE_OCTETS, PROTOCOLE_JOURNAL,
} from '../app/atelier/journal.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { conduire, FAITS } from './atelier-aide.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(RACINE, 'app', 'atelier', 'journal.js'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const K1 = 'temoin-1/1';

// États durables du témoin, par étape (mis en cache : chaque conduite rejoue l'écran).
// Une seule conduite jusqu'à la décision par jeu d'options : tous les états intermédiaires sont relevés au passage.
const cache = new Map();
async function durable(etape, o = {}) {
  const cle = JSON.stringify(o);
  if (!cache.has(cle)) {
    const etats = {};
    await conduire('decide', { ...o, observer: (e, a) => { etats[e] = { copie: a.copie(), ...ecrireEtatDurable(a.copie()) }; } });
    cache.set(cle, etats);
  }
  return cache.get(cle)[etape];
}
const objet = (texte) => JSON.parse(texte);
// Pseudo-hasard déterministe (mélanges reproductibles).
function melanger(l, graine) {
  const r = [...l];
  let x = graine;
  for (let i = r.length - 1; i > 0; i -= 1) { x = (x * 1103515245 + 12345) % 2147483648; const j = x % (i + 1); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
// Contenu synthétique de taille donnée (multioctet compris), pour le transport seul.
const synthese = (n, motif = 'Témoin « D2 » — ligne ordinaire, accents éàü, 漢字 et 😀.\n') => motif.repeat(Math.ceil(n / motif.length)).slice(0, n);

// ------------------------------------------------------------------------------------------------ forme canonique
test('canonique : clés triées, indentation 1, ASCII seul (\\uXXXX), saut de ligne final ; relecture identique', () => {
  const v = { z: 1, a: { d: 'é', c: [2, 'x\u2028y'] }, m: '😀', n: null };
  const t = canonique(v);
  assert.equal(t, '{\n "a": {\n  "c": [\n   2,\n   "x\\u2028y"\n  ],\n  "d": "\\u00e9"\n },\n "m": "\\ud83d\\ude00",\n "n": null,\n "z": 1\n}\n');
  assert.match(t, /^[\x20-\x7e\n]*$/);
  assert.deepEqual(JSON.parse(t), v);
  assert.equal(canonique(JSON.parse(t)), t);
  assert.equal(canonique({ b: 1, a: 2 }), canonique({ a: 2, b: 1 }));
  assert.equal(canonique({ ['__proto__']: 1 }), '{\n "__proto__": 1\n}\n');
  assert.throws(() => canonique(undefined), TypeError);
});

// ------------------------------------------------------------------------------------------------ état durable
test('état durable : seulement l\'histoire franchie (journal AT-1, registre AT-2, pièces) ; ni mode, ni formulaire, ni fiche, ni verdict', async () => {
  const d = await durable('faits', { budget: true });
  const v = objet(d.texte);
  assert.deepEqual(Object.keys(v).sort(), ['chantier', 'journal', 'pieces', 'piecesDepuis', 'protocole', 'registre']);
  assert.equal(v.protocole, PROTOCOLE_JOURNAL);
  assert.equal(v.chantier, 'temoin-atelier');
  assert.deepEqual(v.journal, d.copie.journal);
  assert.deepEqual(v.registre, d.copie.registre);
  assert.equal(v.registre.length, 2);
  assert.deepEqual(v.pieces, d.copie.pieces);
  for (const interdit of ['"mode"', '"formulaire"', '"fiches"', '"sauvegarde"', 'verification-technique', '"mission":']) {
    if (interdit === '"mission":') assert.equal(d.texte.split('"mission":').length - 1, 1, 'seule la mission LANCÉE (pièce) est durable');
    else assert.equal(d.texte.includes(interdit), false, interdit);
  }
  assert.equal(d.empreinte, sha(d.texte));
  assert.equal(d.octets, Buffer.byteLength(d.texte));
  assert.match(d.texte, /^[\x20-\x7e\n]*\n$/);
});
test('état durable : chaque étape franchie est lisible, avec son étape dérivée et ses verdicts recalculés (jamais stockés)', async () => {
  const attendu = { ouvert: 'plan-a-approuver', 'en-cours': 'mission-a-lancer', lancee: 'rapport-attendu', rendue: 'demande-a-copier', demandee: 'faits-attendus', faits: 'decision-attendue', decide: 'chantier-termine' };
  for (const [etape, nom] of Object.entries(attendu)) {
    const d = await durable(etape);
    const lu = lireEtatDurable(d.texte);
    assert.equal(lu.raison, undefined, `${etape} : ${lu.raison}`);
    assert.equal(lu.etape.etape, nom, etape);
    assert.equal(lu.empreinte, d.empreinte);
  }
  assert.deepEqual((await durable('faits')).copie.pieces[K1].faits.length, 1);
  assert.deepEqual(lireEtatDurable((await durable('faits')).texte).verdicts, { [K1]: 'verification-technique-conforme' });
  assert.deepEqual(lireEtatDurable((await durable('faits', { issue: 'non-conforme' })).texte).verdicts, { [K1]: 'verification-technique-non-conforme' });
  const imp = lireEtatDurable((await durable('faits', { issue: 'impossible' })).texte);
  assert.deepEqual([imp.verdicts[K1], imp.etape.etape], ['verification-impossible', 'verification-a-refaire']);
  assert.equal(lireEtatDurable((await durable('decide', { issue: 'non-conforme' })).texte).etape.etape, 'mission-a-lancer');
});
test('état durable : arrêt, blocage et plusieurs tentatives', async () => {
  const a = await conduire('decide', { issue: 'non-conforme' });
  await a.cliquer('generer');
  await a.cliquer('lancer');
  const deux = lireEtatDurable(ecrireEtatDurable(a.copie()).texte);
  assert.deepEqual(Object.keys(deux.lues).sort(), ['temoin-1/1', 'temoin-1/2']);
  assert.equal(deux.etape.etape, 'rapport-attendu');
  a.saisir('motif-decision', 'Témoin abandonné.');
  await a.cliquer('annuler');
  const bloque = lireEtatDurable(ecrireEtatDurable(a.copie()).texte);
  assert.deepEqual([bloque.etat.statut, bloque.etape.etape], ['bloque', 'chantier-bloque']);
  a.saisir('motif-arret', 'Arrêt du témoin.');
  await a.cliquer('arreter');
  assert.equal(lireEtatDurable(ecrireEtatDurable(a.copie()).texte).etape.etape, 'chantier-arrete');
});
test('lecture : tout écart de forme, de protocole, d\'AT-1, d\'AT-2, de pièces, d\'empreinte ou de verdict est refusé, jamais réparé', async () => {
  const d = await durable('decide', { budget: true });
  const v = objet(d.texte);
  const casse = (f) => { const c = structuredClone(v); f(c); return canonique(c); };
  const cas = [
    [d.texte.replace(/\n$/, ''), /forme non canonique/],
    [d.texte.replace('\n "journal"', '\n  "journal"'), /forme non canonique/],
    [d.texte.replace('"chantier": "temoin-atelier"', '"chantier": "temoin-atelier", "chantier": "temoin-atelier"'), /forme non canonique/],
    [d.texte.replace('\\u00e9', 'é'), /hors ASCII/],
    [d.texte.replace(/\n/g, '\r\n'), /hors ASCII/],
    ['{', /JSON illisible/],
    [casse((c) => { c.protocole = 'atelier-journal-2'; }), /protocole inconnu/],
    [casse((c) => { c.verdict = 'verification-technique-conforme'; }), /clés de l'état durable inattendues/],
    [casse((c) => { delete c.registre; }), /clés de l'état durable inattendues/],
    [casse((c) => { c.chantier = 'autre'; }), /différent de celui du journal AT-1/],
    [casse((c) => { c.chantier = 'Temoin'; }), /identifiant du chantier invalide/],
    [casse((c) => { c.journal.splice(2, 1); }), /journal AT-1 incohérent/],
    [casse((c) => { c.journal[1].type = 'tentative-lancee'; }), /journal AT-1 incohérent/],
    [casse((c) => { c.registre[1].donnees.plafond = -1; }), /registre AT-2 incohérent/],
    [casse((c) => { c.piecesDepuis = c.journal.length + 2; }), /début des pièces invalide/],
    [casse((c) => { delete c.pieces[K1]; }), /pièces incohérentes : tentative « temoin-1\/1 » sans sa pièce/],
    [casse((c) => { c.pieces[K1].mission.objectif = 'autre'; }), /instantané différent de l'objectif ou du jalon écrits dans AT-1/],
    [casse((c) => { c.pieces[K1].mission.jalon.titre = 'autre'; }), /instantané différent de l'objectif ou du jalon écrits dans AT-1/],
    [casse((c) => { c.pieces[K1].mission.base.version = '0.65.4'; }), /instantané étranger à sa tentative/],
    [casse((c) => { c.pieces[K1].faits[0] = c.pieces[K1].faits[0].replace('"reussis": 5395', '"reussis": 5394'); }), /faits illisibles.*empreinte/],
    [casse((c) => { c.pieces[K1].faits = []; }), /décision sans faits/],
    [casse((c) => { c.journal.at(-1).donnees.verdict = 'verification-technique-non-conforme'; }), /acceptation citant un verdict non conforme/],
    [casse((c) => { c.journal.at(-1).donnees.run_id = '41000000009'; }), /run cité par la décision différent des faits/],
    [casse((c) => { c.pieces[K1].verdict = 'verification-technique-conforme'; }), /pièce « temoin-1\/1 » illisible/],
  ];
  for (const [t, motif] of cas) {
    const lu = lireEtatDurable(t);
    assert.equal(lu.durable, undefined, String(motif));
    assert.match(lu.raison, motif);
  }
  // Une acceptation qui cite un verdict « conforme » sur des faits non conformes : le recalcul le refuse.
  const nc = await durable('faits', { issue: 'non-conforme' });
  const c = objet(nc.texte);
  c.journal.push({ n: c.journal.length + 1, type: 'tentative-rejetee', quand: 'x', donnees: { jalon: 'temoin-1', numero: 1, motif: 'm', candidat: 'c'.repeat(40), faits: objet(c.pieces[K1].faits[0]).empreinte, verdict: 'verification-technique-conforme', run_id: '41000000001' } });
  assert.match(lireEtatDurable(canonique(c)).raison, /verdict recalculé différent de celui cité par la décision/);
  assert.throws(() => etatDurableDe({ journal: null }), TypeError);
  assert.throws(() => ecrireEtatDurable({ ...d.copie, pieces: {} }), /état durable invalide/);
});

// ------------------------------------------------------------------------------------------------ extension
test('extension : préfixe exact du journal et du registre, pièces complétées seulement, faits en ajout ; identique reconnu', async () => {
  const etapes = ['ouvert', 'en-cours', 'lancee', 'rendue', 'demandee', 'faits', 'decide'];
  const etats = [];
  for (const e of etapes) etats.push(objet((await durable(e)).texte));
  for (let i = 0; i < etats.length; i += 1) {
    assert.deepEqual(comparerEtats(etats[i], etats[i]), { statut: 'identique' });
    for (let j = i + 1; j < etats.length; j += 1) {
      assert.deepEqual(comparerEtats(etats[i], etats[j]), { statut: 'extension' }, `${etapes[i]} -> ${etapes[j]}`);
      assert.ok(comparerEtats(etats[j], etats[i]).raison, `régression ${etapes[j]} -> ${etapes[i]}`);
    }
  }
  // Faits append-only : un second run s'ajoute (extension) ; raccourcir ou modifier est refusé.
  const a = await conduire('faits', { issue: 'impossible' });
  const un = objet(ecrireEtatDurable(a.copie()).texte);
  a.saisir('faits-colles', FAITS({ demande: a.copie().pieces[K1].demande, run: '41000000002' }));
  await a.cliquer('confronter');
  const deux = objet(ecrireEtatDurable(a.copie()).texte);
  assert.deepEqual(comparerEtats(un, deux), { statut: 'extension' });
  assert.match(comparerEtats(deux, un).raison, /journal|faits raccourcis/);
  const v = (f) => { const c = structuredClone(deux); f(c); return c; };
  assert.match(comparerEtats(deux, v((c) => { c.pieces[K1].faits.pop(); })).raison, /faits raccourcis ou modifiés/);
  assert.match(comparerEtats(deux, v((c) => { c.pieces[K1].faits.reverse(); })).raison, /faits raccourcis ou modifiés/);
  assert.match(comparerEtats(deux, v((c) => { c.pieces[K1].demande = null; })).raison, /demande modifiée ou supprimée/);
  assert.match(comparerEtats(deux, v((c) => { c.pieces[K1].rapport = null; })).raison, /rapport modifié ou supprimé/);
  assert.match(comparerEtats(deux, v((c) => { c.pieces[K1].mission.tentative = 2; })).raison, /mission modifiée/);
  assert.match(comparerEtats(deux, v((c) => { delete c.pieces[K1]; })).raison, /pièce « temoin-1\/1 » supprimée/);
  assert.match(comparerEtats(deux, v((c) => { c.journal[1].quand = 'réécrit'; })).raison, /journal AT-1 non prolongé/);
  assert.match(comparerEtats(deux, v((c) => { c.journal.splice(1, 1); })).raison, /journal AT-1 non prolongé/);
  assert.match(comparerEtats(deux, v((c) => { c.piecesDepuis = 2; })).raison, /début des pièces modifié/);
  assert.match(comparerEtats(deux, v((c) => { c.chantier = 'autre'; })).raison, /chantier différent/);
  const b = await durable('ouvert', { budget: true });
  const reg = objet(b.texte);
  assert.match(comparerEtats(reg, { ...reg, registre: null }).raison, /registre AT-2 non prolongé/);
  assert.match(comparerEtats(reg, { ...reg, registre: reg.registre.slice(0, 1) }).raison, /registre AT-2 non prolongé/);
  assert.deepEqual(comparerEtats({ ...reg, registre: null }, reg), { statut: 'extension' });
  // Divergence : deux histoires du même chantier, chacune valide, ni l'une ni l'autre n'étend l'autre.
  const x = objet((await durable('decide', { issue: 'conforme' })).texte);
  const y = objet((await durable('decide', { issue: 'non-conforme' })).texte);
  assert.ok(comparerEtats(x, y).raison);
  assert.ok(comparerEtats(y, x).raison);
});

// ------------------------------------------------------------------------------------------------ transport k/N
test('transport N=1 : même protocole ; aller-retour exact ; parties <= 15 000 caractères et <= 32 768 octets', async () => {
  const d = await durable('decide');
  const p = decouper(d.texte, 'temoin-atelier');
  assert.equal(p.length, 1);
  assert.match(p[0], new RegExp(`^ATELIER-PARTIE-1 chantier=temoin-atelier partie=1/1 total_octets=${d.octets} empreinte=${d.empreinte} tranche=${d.empreinte}\n`));
  assert.ok(p[0].endsWith('\nATELIER-FIN-PARTIE 1/1'));
  const r = assemblerParties(p);
  assert.equal(r.statut, 'complet');
  assert.equal(r.contenu, d.texte);
  assert.deepEqual(assemblerParties([`${p[0]}\n`]).contenu, d.texte); // un saut de ligne final d'enveloppe est toléré
  assert.equal(preparerRestauration(p).statut, 'pret');
});
test('transport N>1 : découpage déterministe, ordre inversé et aléatoire, multioctet (2, 3, 4 octets) exact', () => {
  // N = 1 (juste sous la limite), 2 (juste au-dessus), 3 et 5 : toutes les vérifications, quatre ordres de collage.
  for (const n of [14000, 15000, 40000, 70000]) {
    const t = synthese(n);
    const parties = decouper(t, 'temoin-d2');
    assert.deepEqual(decouper(t, 'temoin-d2'), parties);
    for (const p of parties) assert.ok(p.length <= LIMITE_CARACTERES && octetsUtf8(p) <= LIMITE_OCTETS && Buffer.byteLength(p) === octetsUtf8(p), `${n}`);
    assert.equal(parties.map((p) => lirePartie(p).partie.tranche).join(''), t);
    for (const ordre of [parties, [...parties].reverse(), melanger(parties, n), melanger(parties, n + 1)]) {
      const r = assemblerParties(ordre);
      assert.equal(r.statut, 'complet', `${n}`);
      assert.equal(r.contenu, t);
    }
  }
  // N >= 10 (numéros à deux chiffres) : limites de chaque partie et un ordre de collage mélangé suffisent (mêmes fonctions qu'au-dessus).
  const long = synthese(160000);
  const pl = decouper(long, 'temoin-d2');
  assert.ok(pl.length >= 10, String(pl.length));
  for (const p of pl) assert.ok(p.length <= LIMITE_CARACTERES && octetsUtf8(p) <= LIMITE_OCTETS, 'N >= 10');
  assert.match(pl[9], /^ATELIER-PARTIE-1 chantier=temoin-d2 partie=10\/\d{2} /);
  assert.equal(assemblerParties(melanger(pl, 7)).contenu, long);
  // Aucune paire de substituts coupée, même quand la limite tombe dessus.
  const emoji = '😀'.repeat(20000);
  const pe = decouper(emoji, 'temoin-d2');
  assert.ok(pe.length > 1);
  for (const p of pe) { const tr = lirePartie(p).partie.tranche; assert.ok(!/^[\udc00-\udfff]|[\ud800-\udbff]$/.test(tr)); }
  assert.equal(assemblerParties(pe).contenu, emoji);
  // Une partie au plus juste : 15 000 caractères pile sont acceptés, 15 001 refusés.
  const p0 = decouper('x', 'a')[0];
  const remplir = (n) => p0.replace('\nx\n', `\n${'x'.repeat(n - p0.length + 1)}\n`);
  assert.equal(remplir(LIMITE_CARACTERES).length, LIMITE_CARACTERES);
  assert.match(lirePartie(remplir(LIMITE_CARACTERES)).raison, /SHA-256 de la tranche faux/); // lue jusqu'au contrôle de la tranche
  assert.match(lirePartie(remplir(LIMITE_CARACTERES + 1)).raison, /partie trop longue/);
  assert.match(lirePartie(`${'€'.repeat(11000)}`).raison, /partie trop longue/); // 33 000 octets
});
test('transport : partie manquante nommée, fin absente, mauvais k/N, SHA de tranche faux, k hors bornes, N incohérent', () => {
  const t = synthese(60000);
  const p = decouper(t, 'temoin-d2');
  const N = p.length;
  assert.ok(N >= 4);
  const r = assemblerParties([p[2], p[0]]);
  assert.deepEqual([r.statut, r.recues, r.manquantes.slice(0, 2)], ['incomplet', [1, 3], [2, 4]]);
  assert.equal(r.contenu, undefined);
  assert.equal(r.empreinte, sha(t));
  assert.deepEqual(assemblerParties([]), { statut: 'vide', recues: [], manquantes: [] });
  const refus = (x, motif) => { const a = assemblerParties(x); assert.equal(a.statut, 'refuse'); assert.match(a.raison, motif); assert.equal(a.contenu, undefined); };
  refus([p[0].slice(0, p[0].lastIndexOf('\n'))], /fin de partie absente/);
  refus([p[0].replace(/ATELIER-FIN-PARTIE 1\/\d+$/, `ATELIER-FIN-PARTIE 2/${N}`)], /numéro de la fin \(2\/\d+\) différent du début \(1\/\d+\)/);
  refus([p[0].replace(/^ATELIER-PARTIE-1/, 'ATELIER-PARTIE-2')], /début de partie absent ou invalide/);
  refus([p[0].replace('partie=1/', 'partie=01/')], /début de partie absent ou invalide/);
  refus([`bonjour\n${p[0]}`], /début de partie absent ou invalide/);
  refus([p[0].replace(`partie=1/${N}`, `partie=${N + 1}/${N}`).replace(`FIN-PARTIE 1/${N}`, `FIN-PARTIE ${N + 1}/${N}`)], /numéro hors bornes/);
  refus([p[0], p[1].replace(`partie=2/${N}`, `partie=2/${N + 1}`).replace(`FIN-PARTIE 2/${N}`, `FIN-PARTIE 2/${N + 1}`)], /nombre de parties différent/);
  refus([p[0], p[1].replace(/total_octets=\d+/, 'total_octets=1')], /total_octets différent/);
  refus([p[0], p[1].replace(/empreinte=[0-9a-f]{64}/, `empreinte=${'0'.repeat(64)}`)], /empreinte complète différent/);
  refus([p[1].replace(/tranche=[0-9a-f]{64}/, `tranche=${'0'.repeat(64)}`)], /SHA-256 de la tranche faux/);
  refus([p[1].replace(/\n(.)/, (m, c) => `\n${c === 'a' ? 'b' : 'a'}`)], /SHA-256 de la tranche faux/); // un caractère changé
  refus([p[1].replace(/(\n[^\n]+)\n/, '$1\r\n')], /SHA-256 de la tranche faux/); // une fin de ligne changée
  refus([p[1].replace(/(\n[^\n]+)\n/, '$1')], /SHA-256 de la tranche faux/); // une fin de ligne supprimée
  refus([p[1].replace(/\n([^\n]+)\n/, '\n$1\n\n')], /SHA-256 de la tranche faux/); // une fin de ligne ajoutée
  refus(['', p[0]], /partie vide/);
  // Enveloppe : un seul saut de ligne final est toléré ; deux, un espace, un retour chariot : refus (aucune normalisation).
  for (const x of [`${p[0]}\n\n`, `${p[0]} `, `${p[0]}\r\n`, `${p[0]}\t`, ` ${p[0]}`]) refus([x], /fin de partie absente|début de partie absent/);
});
test('transport : mélange de deux chantiers ou de deux sauvegardes du même chantier refusé ; doublon identique ignoré, différent refusé', () => {
  const t1 = synthese(40000);
  const t2 = `${t1.slice(0, -1)}!`;
  const a = decouper(t1, 'chantier-a');
  const b = decouper(t1, 'chantier-b');
  const c = decouper(t2, 'chantier-a');
  assert.match(assemblerParties([a[0], b[1]]).raison, /chantier différent/);
  assert.match(assemblerParties([a[0], c[1]]).raison, /empreinte complète différent.*mélange de deux sauvegardes/);
  assert.match(assemblerParties([a[0], c[0]]).raison, /empreinte complète différent/);
  const ok = assemblerParties([a[1], a[0], a[1], `${a[0]}\n`, ...a.slice(2)]);
  assert.deepEqual([ok.statut, ok.contenu === t1], ['complet', true]);
  // Même k, même empreinte annoncée, tranche différente mais cohérente avec son propre SHA : refus.
  const autre = a[0].replace(/tranche=[0-9a-f]{64}\n[\s\S]*\nATELIER-FIN/, (m) => m.replace(/\n[\s\S]*\n/, '\nX\n').replace(/tranche=[0-9a-f]{64}/, `tranche=${sha('X')}`));
  assert.equal(lirePartie(autre).partie.tranche, 'X');
  assert.match(assemblerParties([a[0], autre]).raison, /partie 1\/\d+ reçue deux fois avec des contenus différents/);
  // Même longueur, un caractère changé, SHA de tranche recalculé : la partie est cohérente seule, seul le SHA complet la refuse.
  const t0 = lirePartie(a[0]).partie.tranche;
  const t0b = `${t0.slice(0, 10)}${t0[10] === 'Z' ? 'Y' : 'Z'}${t0.slice(11)}`;
  assert.equal(Buffer.byteLength(t0b), Buffer.byteLength(t0));
  const a0b = a[0].replace(/tranche=[0-9a-f]{64}/, `tranche=${sha(t0b)}`).replace(t0, t0b);
  assert.equal(lirePartie(a0b).partie.tranche, t0b);
  assert.match(assemblerParties([a0b, ...a.slice(1)]).raison, /^SHA-256 complet faux après assemblage$/);
  // Toutes les parties présentes mais une tranche cohérente remplacée : le SHA complet refuse.
  const fausses = [autre, ...a.slice(1)];
  assert.match(assemblerParties(fausses).raison, /annoncés|SHA-256 complet faux/);
});
test('troncature D2 : un bloc coupé à exactement 20 000 caractères (comme l\'envoi du téléphone) est refusé, rien n\'est assemblé', () => {
  const t = synthese(60000);
  const p = decouper(t, 'temoin-d2');
  const colle = p.slice(0, 2).join('\n');
  assert.ok(colle.length > 20000);
  const coupe = colle.slice(0, 20000);
  for (const x of [coupe, p[0].slice(0, 9000), p[0].slice(0, -1), p[0].slice(0, -'ATELIER-FIN-PARTIE 1/5'.length)]) {
    const r = assemblerParties([x]);
    assert.equal(r.statut, 'refuse', x.slice(-40));
    assert.equal(r.contenu, undefined);
  }
  // Une partie unique hypothétique de 25 ko (hors limites) coupée à 20 000 caractères : refusée aussi.
  const gros = `ATELIER-PARTIE-1 chantier=temoin-d2 partie=1/1 total_octets=1 empreinte=${'0'.repeat(64)} tranche=${'0'.repeat(64)}\n${'x'.repeat(25000)}\nATELIER-FIN-PARTIE 1/1`;
  assert.match(assemblerParties([gros]).raison, /partie trop longue/);
  assert.match(assemblerParties([gros.slice(0, 20000)]).raison, /partie trop longue|fin de partie absente/);
});
test('restauration préparée : assemblage complet PUIS lecture complète ; un état invalide reste invalide même bien transporté', async () => {
  const d = await durable('faits');
  const ok = preparerRestauration(decouper(d.texte, 'temoin-atelier'));
  assert.equal(ok.statut, 'pret');
  assert.equal(ok.texte, d.texte);
  assert.equal(ok.lu.verdicts[K1], 'verification-technique-conforme');
  const v = objet(d.texte);
  v.pieces[K1].demande = null;
  const invalide = canonique(v);
  const r = preparerRestauration(decouper(invalide, 'temoin-atelier'));
  assert.equal(r.statut, 'refuse');
  assert.match(r.raison, /^état durable invalide : pièces incohérentes : pièce « temoin-1\/1 » : faits sans demande copiée/);
  assert.match(preparerRestauration(decouper(d.texte, 'autre-chantier')).raison, /chantier des parties différent/);
  assert.equal(preparerRestauration(decouper(d.texte, 'temoin-atelier').slice(0, 0)).statut, 'vide');
});

// ------------------------------------------------------------------------------------------------ confirmation et branche
test('confirmation ATELIER-SAUVEGARDE-1 : exacte, une ligne ; toute autre forme refusée ; branche journal-atelier/<chantier>', () => {
  const c = texteConfirmation({ chantier: 'temoin-at7', empreinte: 'a'.repeat(64), commit: 'b'.repeat(40) });
  assert.equal(c, `ATELIER-SAUVEGARDE-1 chantier=temoin-at7 empreinte=${'a'.repeat(64)} commit=${'b'.repeat(40)}`);
  assert.deepEqual(lireConfirmation(c), { chantier: 'temoin-at7', empreinte: 'a'.repeat(64), commit: 'b'.repeat(40) });
  assert.deepEqual(lireConfirmation(`${c}\n`), lireConfirmation(c));
  for (const x of [`${c}\n\n`, ` ${c}`, c.replace('commit=', 'commit= '), c.slice(0, -1), c.toUpperCase(), c.replace('-1 ', '-2 '), `${c}\r`, null]) assert.ok(lireConfirmation(x).raison, String(x));
  assert.throws(() => texteConfirmation({ chantier: 'X', empreinte: 'a'.repeat(64), commit: 'b'.repeat(40) }), TypeError);
  assert.equal(brancheJournal('temoin-at7'), 'journal-atelier/temoin-at7');
});

// ------------------------------------------------------------------------------------------------ frontières statiques
test('pureté : imports de l\'atelier seulement ; aucune horloge, aucun hasard, aucune entrée/sortie, aucun réseau, aucun stockage', () => {
  const imports = [...CODE.matchAll(/^\s*import\b[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./budget.js', './chantier.js', './empreinte.js', './mission.js', './parcours.js', './verification.js']);
  assert.doesNotMatch(CODE, /\bimport\(|\brequire\(/);
  for (const m of [/\bDate\b/, /Math\.random/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bfetch\b/, /localStorage/, /indexedDB/, /\basync\b/, /\bawait\b/, /\bdocument\b/, /\bnavigator\b/,
    /\bglobalThis\b/, /\bwindow\b/, /\bprocess\b/, /performance\./, /\bcrypto\b/, /node:/, /XMLHttpRequest/, /https?:/, /\bgit\b/]) assert.equal(m.test(CODE), false, String(m));
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  assert.deepEqual(Object.keys(MODULE).sort(), ['LIMITE_CARACTERES', 'LIMITE_OCTETS', 'PROTOCOLE_JOURNAL', 'assemblerParties', 'brancheJournal', 'canonique', 'comparerEtats', 'decouper',
    'ecrireEtatDurable', 'etatDurableDe', 'lireConfirmation', 'lireEtatDurable', 'lirePartie', 'lirePieces', 'octetsUtf8', 'preparerRestauration', 'texteConfirmation']);
  assert.deepEqual([LIMITE_CARACTERES, LIMITE_OCTETS], [15000, 32768]);
  assert.ok(SRC.split('\n').length < 320);
});
test('base cognitive inchangée : VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables ; le journal de l\'atelier ne nomme aucune table', () => {
  assert.equal(VERSION_BASE, 29);
  assert.equal(SCHEMA_SAUVEGARDE, 19);
  assert.equal(TABLES.length, 35);
  for (const t of TABLES) assert.equal(CODE.includes(`'${t}'`), false, t);
});
