// v0.65.7 — AT-7 « JOURNAL GIT + REPRISE » (GO 17/10/2026 ; D-007 précision D4). OUTILLAGE NON COGNITIF.
// app/atelier/journal.js, module PUR : forme canonique de l'état durable atelier-journal-1, lecture complète (AT-1, AT-2, pièces,
// empreintes, verdicts recalculés), extension autorisée, transport multiparties k/N (étude D2 : 20 000 caractères, 32 768 octets).
// v0.65.8 : transport atelier-partie-2 (Base64 ASCII des octets exacts), après le STOP recette phase G.
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

// ------------------------------------------------------------------------------------------------ transport k/N (atelier-partie-2)
// v0.65.8 : la tranche voyage en Base64 ASCII de ses octets exacts. Références INDÉPENDANTES du module : Buffer (Base64, UTF-8) et
// node:crypto (SHA-256 des octets). BS = barre oblique inverse, construite ici : le texte de ce test n'en contient aucune suivie de « u ».
const BS = String.fromCharCode(92);
const octets = (t) => Buffer.from(t, 'utf8');
const shaO = (b) => createHash('sha256').update(b).digest('hex');
const corpsDe = (p) => p.split('\n').slice(1, -1);
const lignes76 = (s) => s.match(/.{1,76}/g);
// Partie forgée sans le module : en-tête annoncé, octets quelconques, Base64 de Node en lignes de 76.
function forger({ chantier = 'temoin-d2', k = 1, N = 1, total, empreinte, tranche }, o, b64 = o.toString('base64')) {
  return `ATELIER-PARTIE-2 chantier=${chantier} partie=${k}/${N} total_octets=${total ?? o.length} empreinte=${empreinte ?? shaO(o)} encodage=base64 tranche=${tranche ?? shaO(o)}\n${lignes76(b64).join('\n')}\nATELIER-FIN-PARTIE ${k}/${N}`;
}
// Ce que la couche d'écriture de Claude a fait au STOP phase G : chaque séquence BS + « u » + 4 hexadécimaux devient le caractère.
const alterer = (t) => t.replace(new RegExp(`${BS}${BS}u([0-9a-fA-F]{4})`, 'g'), (m, h) => String.fromCharCode(parseInt(h, 16)));
const synthese2 = (n) => synthese(n, `Témoin « D2 » — "guillemets", ${BS}${BS} antislash, séquence ${BS}u00e9 littérale, éàü 漢字 😀.\n`);

test('transport N=1 : ATELIER-PARTIE-2, Base64 des octets canoniques exacts (référence Buffer) ; aller-retour exact ; ASCII seul', async () => {
  const d = await durable('decide');
  const p = decouper(d.texte, 'temoin-atelier');
  assert.equal(p.length, 1);
  assert.match(p[0], new RegExp(`^ATELIER-PARTIE-2 chantier=temoin-atelier partie=1/1 total_octets=${d.octets} empreinte=${d.empreinte} encodage=base64 tranche=${d.empreinte}\n`));
  assert.ok(p[0].endsWith('\nATELIER-FIN-PARTIE 1/1'));
  assert.deepEqual(corpsDe(p[0]), lignes76(octets(d.texte).toString('base64')));
  assert.match(p[0], /^[\x20-\x7e\n]+$/);
  assert.equal(p[0].includes(BS), false);
  const r = assemblerParties(p);
  assert.equal(r.statut, 'complet');
  assert.ok(octets(r.contenu).equals(octets(d.texte)));
  assert.equal(r.empreinte, shaO(octets(d.texte)));
  assert.equal(assemblerParties([`${p[0]}\n`]).contenu, d.texte); // un saut de ligne final d'enveloppe est toléré
  assert.equal(preparerRestauration(p).statut, 'pret');
});
test('défaut du STOP phase G reproduit : le texte canonique est altéré par la couche de Claude, la partie Base64 ne l\'est pas', async () => {
  const d = await durable('decide');
  const n = d.texte.split(`${BS}u`).length - 1;
  assert.ok(n >= 10, String(n)); // accents de l'objectif, des critères et du rapport : échappés par la forme canonique
  assert.notEqual(alterer(d.texte), d.texte); // l'ancien transport, tranche en clair, était altéré (puis refusé par son SHA)
  const p = decouper(d.texte, 'temoin-atelier');
  assert.deepEqual(p.map(alterer), p); // invariant : aucune séquence altérable dans une partie
  const r = preparerRestauration(p.map(alterer));
  assert.equal(r.statut, 'pret');
  assert.ok(octets(r.texte).equals(octets(d.texte))); // journal canonique -> transport ASCII -> récupération : octets identiques
  assert.equal(r.empreinte, d.empreinte);
  // L'ancien format est refusé explicitement, sans lecture de sa tranche : aucune double représentation admise.
  const ancien = `ATELIER-PARTIE-1 chantier=temoin-atelier partie=1/1 total_octets=${d.octets} empreinte=${d.empreinte} tranche=${d.empreinte}\n${d.texte}\nATELIER-FIN-PARTIE 1/1`;
  assert.match(assemblerParties([ancien]).raison, /format ATELIER-PARTIE-1 retiré en v0\.65\.8 : demande à Claude un nouvel envoi \(ATELIER-PARTIE-2\)/);
});
test('transport N>1 : découpage déterministe par octets, ordre inversé et aléatoire, multioctet, guillemets, antislash, LF exacts', () => {
  // 10 800 octets par tranche au plus : N = 1 (pile), 2 (un octet de plus), puis 3 et 5 ; toutes les vérifications, quatre ordres.
  for (const t of ['x'.repeat(10800), 'x'.repeat(10801), synthese2(14000), synthese2(30000)]) {
    const parties = decouper(t, 'temoin-d2');
    assert.deepEqual(decouper(t, 'temoin-d2'), parties);
    let debut = 0;
    for (const p of parties) {
      assert.ok(p.length <= 14885 && p.length <= LIMITE_CARACTERES && octetsUtf8(p) === p.length, `${t.length}`);
      const o = Buffer.from(corpsDe(p).join(''), 'base64');
      assert.ok(o.length <= 10800);
      assert.ok(o.equals(octets(t).subarray(debut, debut + o.length))); // tranches consécutives, sans recouvrement
      assert.equal(p.split('\n')[0].split('tranche=')[1], shaO(o)); // SHA de tranche = SHA-256 des octets décodés
      debut += o.length;
    }
    assert.equal(debut, octets(t).length);
    assert.equal(parties.map((p) => lirePartie(p).partie.tranche).join(''), t);
    for (const ordre of [parties, [...parties].reverse(), melanger(parties, t.length), melanger(parties, t.length + 1)]) {
      const r = assemblerParties(ordre);
      assert.equal(r.statut, 'complet', `${t.length}`);
      assert.ok(octets(r.contenu).equals(octets(t)));
    }
  }
  assert.deepEqual([decouper('x'.repeat(10800), 'a').length, decouper('x'.repeat(10801), 'a').length], [1, 2]);
  // N >= 10 (numéros à deux chiffres).
  const long = synthese2(90000);
  const pl = decouper(long, 'temoin-d2');
  assert.ok(pl.length >= 10, String(pl.length));
  assert.match(pl[9], /^ATELIER-PARTIE-2 chantier=temoin-d2 partie=10\/\d{2} /);
  assert.equal(assemblerParties(melanger(pl, 7)).contenu, long);
  // Aucune séquence UTF-8 coupée (4 octets), même quand la limite tombe dessus ; chaque tranche se décode seule.
  const emoji = '😀'.repeat(6000);
  const pe = decouper(emoji, 'temoin-d2');
  assert.ok(pe.length > 1);
  for (const p of pe) assert.equal(lirePartie(p).partie.octets % 4, 0);
  assert.equal(assemblerParties(pe).contenu, emoji);
  // Pleine charge au plus long : chantier de 40 caractères, total à 9 chiffres, k/N à 3 chiffres -> 14 885 caractères, sous 15 000.
  const plein = forger({ chantier: 'a'.repeat(40), k: 999, N: 999, total: 999999999, empreinte: '0'.repeat(64) }, Buffer.alloc(10800, 120));
  assert.equal(plein.length, 14885);
  assert.equal(lirePartie(plein).partie.octets, 10800);
  assert.match(lirePartie(forger({}, Buffer.alloc(10803, 120))).raison, /tranche de 10803 octets \(au plus 10800\)/);
  assert.match(lirePartie(`${plein}${'x'.repeat(LIMITE_CARACTERES - plein.length + 1)}`).raison, /partie trop longue/);
  assert.match(lirePartie('€'.repeat(11000)).raison, /partie trop longue/); // 33 000 octets
  assert.throws(() => decouper(`a${String.fromCharCode(0xd800)}b`, 'a'), /substitut UTF-16 isolé/);
});
test('transport : Base64 strict — alphabet, caractère modifié, remplissage, bits de remplissage, lignes, octets UTF-8 non stricts', () => {
  const t = synthese2(3000);
  const [p] = decouper(t, 'temoin-d2');
  const refus = (x, motif) => { const a = assemblerParties([x]); assert.equal(a.statut, 'refuse', x.slice(0, 300)); assert.match(a.raison, motif); assert.equal(a.contenu, undefined); };
  const L = p.split('\n');
  const avec = (i, l) => [...L.slice(0, i), l, ...L.slice(i + 1)].join('\n');
  const B64 = /Base64 invalide/;
  const ALPHA = /Base64 invalide \(alphabet ou lignes de 76 caractères attendus\)/;
  const LONG = /Base64 invalide \(longueur ou remplissage « = »\)/;
  for (const c of ['-', '_', '.', ' ', '\t', '\r', 'é', String.fromCharCode(0xa0)]) refus(avec(2, `${L[2].slice(0, 30)}${c}${L[2].slice(31)}`), ALPHA); // hors alphabet
  refus(avec(2, `${L[2].slice(0, 30)}${L[2][30] === 'A' ? 'B' : 'A'}${L[2].slice(31)}`), /SHA-256 de la tranche faux|non UTF-8/); // un caractère changé
  refus(avec(2, L[2].slice(0, 75)), ALPHA); // une ligne raccourcie
  refus(avec(2, `${L[2]}${L[3]}`).replace(`\n${L[3]}\n`, '\n'), B64); // deux lignes réunies (152 caractères)
  refus(p.replace(`\n${L[2]}\n`, `\n${L[2]}\n\n`), ALPHA); // ligne vide
  refus(p.replace(`\n${L[2]}\n`, `\n${L[2]}\r\n`), B64); // retour chariot
  refus(p.replace(`\n${L[2]}\n`, `\n${L[2]} \n`), B64); // espace final
  refus([L[0], ...lignes76(corpsDe(p).join('')).join('').match(/.{1,64}/g), L[L.length - 1]].join('\n'), B64); // autre largeur de ligne
  // Remplissage : absent, en trop, au milieu ; bits de remplissage non nuls (« QR== » au lieu de « QQ== », « QUJ= » au lieu de « QUI= ») : une seule forme admise.
  const un = Buffer.from('A');
  assert.equal(lirePartie(forger({}, un)).partie.tranche, 'A');
  for (const b64 of ['QQ', 'QQ=', 'QQ===', 'QR==', 'Q===', '=QQ=', 'QQ==QQ==', 'QUI=', 'QUJ=']) {
    const x = forger({}, un, b64);
    if (b64 === 'QUI=') { assert.match(lirePartie(x).raison, /SHA-256 de la tranche faux/); continue; } // valide, autres octets (« AB »)
    assert.match(lirePartie(x).raison, ['QR==', 'QUJ='].includes(b64) ? /Base64 invalide \(bits de remplissage non nuls\)/ : LONG, b64);
  }
  // Charge multiple de 76 caractères suivie d'une ligne vide : refusée (sinon deux représentations de la même tranche).
  const p57 = forger({}, Buffer.alloc(57, 65));
  assert.equal(corpsDe(p57).length, 1);
  assert.equal(lirePartie(p57).partie.octets, 57);
  refus(p57.replace('\nATELIER-FIN', '\n\nATELIER-FIN'), ALPHA);
  // Octets non UTF-8 stricts, même annoncés avec leur propre SHA : séquence invalide, coupée, trop longue, substitut, hors Unicode.
  for (const o of [[0xc3, 0x28], [0xc3], [0xe2, 0x82], [0xc0, 0xaf], [0xe0, 0x80, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xff], [0x80]]) {
    assert.match(lirePartie(forger({}, Buffer.from(o))).raison, /octets de la tranche non UTF-8 \(strict\)/, o.join(','));
  }
  // Octets UTF-8 valides de 1 à 4 octets, BOM compris : rendus tels quels (aucune normalisation, aucun BOM retiré).
  for (const s of [`${String.fromCharCode(0xfeff)}A`, 'é', `e${String.fromCharCode(0x301)}`, '漢', '😀', `${BS}u00e9`, '"\\\n']) {
    const tr = lirePartie(forger({}, octets(s))).partie.tranche;
    assert.ok(octets(tr).equals(octets(s)), s);
  }
});
test('transport : partie manquante nommée, fin absente, mauvais k/N, SHA de tranche faux, k hors bornes, N incohérent', () => {
  const t = synthese2(40000);
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
  refus([p[0].replace(/^ATELIER-PARTIE-2/, 'ATELIER-PARTIE-3')], /début de partie absent ou invalide/);
  refus([p[0].replace(' encodage=base64', '')], /début de partie absent ou invalide/);
  refus([p[0].replace('encodage=base64', 'encodage=base32')], /début de partie absent ou invalide/);
  refus([p[0].replace('partie=1/', 'partie=01/')], /début de partie absent ou invalide/);
  refus([`bonjour\n${p[0]}`], /début de partie absent ou invalide/);
  refus([p[0].replace(`partie=1/${N}`, `partie=${N + 1}/${N}`).replace(`FIN-PARTIE 1/${N}`, `FIN-PARTIE ${N + 1}/${N}`)], /numéro hors bornes/);
  refus([p[0], p[1].replace(`partie=2/${N}`, `partie=2/${N + 1}`).replace(`FIN-PARTIE 2/${N}`, `FIN-PARTIE 2/${N + 1}`)], /nombre de parties différent/);
  refus([p[0], p[1].replace(/total_octets=\d+/, 'total_octets=1')], /total_octets différent/);
  refus([p[0], p[1].replace(/empreinte=[0-9a-f]{64}/, `empreinte=${'0'.repeat(64)}`)], /empreinte complète différent/);
  refus([p[1].replace(/tranche=[0-9a-f]{64}/, `tranche=${'0'.repeat(64)}`)], /SHA-256 de la tranche faux/);
  refus(['', p[0]], /partie vide/);
  // total_octets faux sur TOUTES les parties (cohérentes entre elles) : seul l'assemblage le voit.
  refus(p.map((x) => x.replace(/total_octets=\d+/, 'total_octets=7')), /assemblage de \d+ octets, 7 annoncés/);
  // Enveloppe : un seul saut de ligne final est toléré ; deux, un espace, un retour chariot : refus (aucune normalisation).
  for (const x of [`${p[0]}\n\n`, `${p[0]} `, `${p[0]}\r\n`, `${p[0]}\t`, ` ${p[0]}`]) refus([x], /fin de partie absente|début de partie absent/);
});
test('transport : mélange de deux chantiers ou de deux exports du même chantier refusé ; doublon identique ignoré, différent refusé', () => {
  const t1 = synthese2(30000);
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
  const tete = lirePartie(a[0]).partie;
  const autre = forger({ chantier: 'chantier-a', k: 1, N: a.length, total: tete.total, empreinte: tete.empreinte }, Buffer.from('X'));
  assert.equal(lirePartie(autre).partie.tranche, 'X');
  assert.match(assemblerParties([a[0], autre]).raison, /partie 1\/\d+ reçue deux fois avec des contenus différents/);
  // Même longueur, un octet changé, SHA de tranche recalculé : la partie est cohérente seule, seul le SHA complet la refuse.
  const o0 = octets(tete.tranche);
  const o0b = Buffer.from(o0);
  o0b[10] = o0b[10] === 0x5a ? 0x59 : 0x5a;
  const a0b = forger({ chantier: 'chantier-a', k: 1, N: a.length, total: tete.total, empreinte: tete.empreinte }, o0b);
  assert.equal(lirePartie(a0b).partie.octets, o0.length);
  assert.match(assemblerParties([a0b, ...a.slice(1)]).raison, /^SHA-256 complet faux après assemblage$/);
  // Toutes les parties présentes mais une tranche cohérente remplacée : le total ou le SHA complet refuse.
  assert.match(assemblerParties([autre, ...a.slice(1)]).raison, /annoncés|SHA-256 complet faux/);
});
test('troncature D2 : un bloc coupé à exactement 20 000 caractères (comme l\'envoi du téléphone) est refusé, rien n\'est assemblé', () => {
  const t = synthese2(40000);
  const p = decouper(t, 'temoin-d2');
  const colle = p.slice(0, 2).join('\n');
  assert.ok(colle.length > 20000);
  const coupe = colle.slice(0, 20000);
  for (const x of [coupe, p[0].slice(0, 9000), p[0].slice(0, -1), p[0].slice(0, -'ATELIER-FIN-PARTIE 1/5'.length), p[0].slice(0, p[0].lastIndexOf('\n') - 5) + p[0].slice(p[0].lastIndexOf('\n'))]) {
    const r = assemblerParties([x]);
    assert.equal(r.statut, 'refuse', x.slice(-40));
    assert.equal(r.contenu, undefined);
  }
  // Une partie unique hypothétique de 25 ko (hors limites) coupée à 20 000 caractères : refusée aussi.
  const gros = forger({}, Buffer.alloc(18000, 120));
  assert.ok(gros.length > 24000);
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
  // MISE À JOUR DÉLIBÉRÉE v0.65.16 (AT-10.5) : + ./auto.js (rapportCandidat, lireFaitsAuto, lireRetourAuto, tous purs) ; + confrontationDe.
  assert.deepEqual(imports, ['./auto.js', './budget.js', './chantier.js', './empreinte.js', './mission.js', './parcours.js', './verification.js']);
  assert.doesNotMatch(CODE, /\bimport\(|\brequire\(/);
  for (const m of [/\bDate\b/, /Math\.random/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bfetch\b/, /localStorage/, /indexedDB/, /\basync\b/, /\bawait\b/, /\bdocument\b/, /\bnavigator\b/,
    /\bglobalThis\b/, /\bwindow\b/, /\bprocess\b/, /performance\./, /\bcrypto\b/, /node:/, /XMLHttpRequest/, /https?:/, /\bgit\b/]) assert.equal(m.test(CODE), false, String(m));
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  // MISE À JOUR DÉLIBÉRÉE v0.65.21 (AT-10.4) : + versOctets, depuisOctets, versBase64, depuisBase64, exportés sans changement (même code)
  // pour le transport des faits par annotations et le bloc ATELIER-RETOUR-1 (retour.js) ; formats du journal inchangés.
  assert.deepEqual(Object.keys(MODULE).sort(), ['LIMITE_CARACTERES', 'LIMITE_OCTETS', 'PROTOCOLE_JOURNAL', 'assemblerParties', 'brancheJournal', 'canonique', 'comparerEtats', 'confrontationDe', 'decouper',
    'depuisBase64', 'depuisOctets', 'ecrireEtatDurable', 'etatDurableDe', 'lireConfirmation', 'lireEtatDurable', 'lirePartie', 'lirePieces', 'octetsUtf8', 'preparerRestauration', 'texteConfirmation', 'versBase64', 'versOctets']);
  assert.deepEqual([LIMITE_CARACTERES, LIMITE_OCTETS], [15000, 32768]);
  assert.ok(SRC.split('\n').length < 410); // MISE À JOUR DÉLIBÉRÉE v0.65.21 (AT-10.4 : note d'en-tête des quatre exports) : 400 -> 410 lignes
});
test('base cognitive inchangée : VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables ; le journal de l\'atelier ne nomme aucune table', () => {
  assert.equal(VERSION_BASE, 30); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 20); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  for (const t of TABLES) assert.equal(CODE.includes(`'${t}'`), false, t);
});
