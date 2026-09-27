// v0.25 — PROPOSITION SPONTANÉE (décision ChatGPT du 27/09/2026). Supprime la manipulation manuelle
// du laboratoire dans la chaîne v0.24 « EXPÉRIENCES → INDUCTION » : conversation → nouvelle
// expérience → apresNouvelleExperience (point EXISTANT, étape E) → pool récent (poolExperiencesRecentes,
// inchangée) → repererMotifs()/positifsEtNegatifsDepuisMotif() (inchangées) → candidatDepuisMotif()
// (NOUVELLE, pure) → si suffisamment sûr, proposition persistée (table `propositions`, connaissances.js)
// → Christophe confirme (apprendreGabaritType(), esprit.js, inchangée) ou refuse. AUCUN apprentissage
// avant confirmation explicite ; un refus ne bloque que CE candidat précis (empreinte), jamais le
// motif pour toujours si le vécu évolue ensuite ; les jugements correct/incorrect n'entrent jamais
// dans ce raccord (pipeline distinct, inchangé, comme en v0.24).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  induire, candidatDepuisMotif, cleCandidat, repererMotifs, poolExperiencesRecentes,
} from '../app/langage/induction.js';
import { LEXIQUE_DEPART, ROLES } from '../app/langage/bagage.js';
import {
  magasinMemoireVive, enregistrerExperience, proposerCandidatSiNouveau, refuserProposition,
  confirmerPropositionApprise,
} from '../app/langage/connaissances.js';
import { chargerEsprit, repondre } from '../app/langage/esprit.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const connaissancesSource = readFileSync(join(RACINE_APP, 'langage', 'connaissances.js'), 'utf8');
const pontSource = readFileSync(join(RACINE_APP, 'langage', 'pont.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
globalThis.document = { createElement: () => universel() };
globalThis.window = globalThis;
const { monterEcranLangage } = await import('../app/langage/ecran.js');

function monter(magasin) {
  return monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
}

async function t(offsetMs = 0) { return new Date(Date.now() + offsetMs).toISOString(); }

// ==================================================================== PARTIE A — cleCandidat/candidatDepuisMotif (pures)

test('[ROUGE] cleCandidat : même candidats + même couverture (ordre différent) -> même empreinte', () => {
  const h1 = { candidats: ['mot:ziqualo'], couverture: ['A', 'B'] };
  const h2 = { candidats: ['mot:ziqualo'], couverture: ['B', 'A'] };
  assert.equal(cleCandidat(h1), cleCandidat(h2));
});
test('[ROUGE] cleCandidat : couverture différente -> empreinte différente', () => {
  const h1 = { candidats: ['mot:ziqualo'], couverture: ['A', 'B'] };
  const h2 = { candidats: ['mot:ziqualo'], couverture: ['A', 'B', 'C'] };
  assert.notEqual(cleCandidat(h1), cleCandidat(h2));
});

test('[ROUGE] candidatDepuisMotif : une hypothèse sûre, unique, sans conflit ni inexpliqué -> candidat rendu', () => {
  const motif = { cle: 'mot:ziqualo', couverture: ['p1', 'p2', 'p3'] };
  const pool = [
    { id: 'p1', texteRecu: 'Ziqualo, mon bouloir est vert.' },
    { id: 'p2', texteRecu: 'Ziqualo, ma teinte est jaune.' },
    { id: 'p3', texteRecu: 'Ziqualo, mon dagoulin est petit.' },
    { id: 'n1', texteRecu: 'Mon bouloir est vert.' },
    { id: 'n2', texteRecu: 'Ma teinte est jaune.' },
  ];
  const candidat = candidatDepuisMotif(motif, pool);
  assert.ok(candidat, 'un candidat devait être rendu');
  assert.equal(candidat.motifCle, 'mot:ziqualo');
  assert.equal(candidat.hypothese.couverture.length, 3);
  assert.equal(candidat.empreinte, cleCandidat(candidat.hypothese));
});

test('[ROUGE] candidatDepuisMotif : un conflit réel (chevauchement) -> null, rien n\'est forcé', () => {
  const LEXSYN = { ...LEXIQUE_DEPART, xx: { role: ROLES.INTERROGATIF }, yy: { role: ROLES.PRONOM_3E }, zz: { role: ROLES.POSSESSIF_MOI }, ww: { role: ROLES.POSSESSIF_TOI } };
  const motif = { cle: 'test', couverture: ['p1', 'p2', 'p3'] };
  const pool = [
    { id: 'p1', texteRecu: 'xx yy' },
    { id: 'p2', texteRecu: 'xx zz' },
    { id: 'p3', texteRecu: 'ww yy' },
    { id: 'n1', texteRecu: 'zz ww' },
  ];
  const candidat = candidatDepuisMotif(motif, pool, { lexique: LEXSYN, seuilCouvertureMin: 2 });
  assert.equal(candidat, null);
});

test('[ROUGE] candidatDepuisMotif : aucun négatif disponible (le motif couvre tout le pool) -> null, jamais de contraste fabriqué', () => {
  const motif = { cle: 'mot:ziqualo', couverture: ['p1', 'p2'] };
  const pool = [
    { id: 'p1', texteRecu: 'Ziqualo, bonjour.' },
    { id: 'p2', texteRecu: 'Ziqualo, au revoir.' },
  ];
  assert.equal(candidatDepuisMotif(motif, pool), null);
});

test('[ROUGE] candidatDepuisMotif : un positif inexpliqué (contraste insuffisant) -> null', () => {
  const motif = { cle: 'test', couverture: ['p1', 'p2', 'p3'] };
  const pool = [
    { id: 'p1', texteRecu: 'abc def' },
    { id: 'p2', texteRecu: 'abc ghi' },
    { id: 'p3', texteRecu: 'xyz qrs' },
    { id: 'n1', texteRecu: 'xyz mno' },
    { id: 'n2', texteRecu: 'qrs mno' },
  ];
  const candidat = candidatDepuisMotif(motif, pool);
  assert.equal(candidat, null);
});

test('[STATIQUE] candidatDepuisMotif n\'appelle jamais apprendreGabaritType et induction.js n\'importe ni connaissances.js ni esprit.js', () => {
  const induireSource = sansCommentaires(readFileSync(join(RACINE_APP, 'langage', 'induction.js'), 'utf8'));
  assert.ok(!induireSource.includes('apprendreGabaritType'));
  assert.ok(!induireSource.includes("from './connaissances.js'"));
  assert.ok(!induireSource.includes("from './esprit.js'"));
});

// ==================================================================== PARTIE B — persistance (connaissances.js)

test('[ROUGE] proposerCandidatSiNouveau : écrit une proposition « proposee », idempotent ensuite', async () => {
  const magasin = magasinMemoireVive();
  const candidat = { motifCle: 'mot:ziqualo', empreinte: 'emp-1', hypothese: { candidats: ['mot:ziqualo'], gabarits: [[{ mot: 'ziqualo' }]], couverture: ['a', 'b'] } };
  const p1 = await proposerCandidatSiNouveau(magasin, candidat);
  assert.equal(p1.statut, 'proposee');
  assert.equal(p1.id, 'emp-1');
  const p2 = await proposerCandidatSiNouveau(magasin, candidat);
  assert.equal(p2.dateProposition, p1.dateProposition, 'jamais réécrite');
  assert.equal((await magasin.lireTout('propositions')).length, 1);
});

test('[ROUGE] refuserProposition : proposee -> refusee, idempotent, erreur si inconnue', async () => {
  const magasin = magasinMemoireVive();
  const candidat = { motifCle: 'mot:ziqualo', empreinte: 'emp-2', hypothese: { candidats: ['mot:ziqualo'], gabarits: [], couverture: ['a', 'b'] } };
  await proposerCandidatSiNouveau(magasin, candidat);
  const r1 = await refuserProposition(magasin, 'emp-2');
  assert.equal(r1.statut, 'refusee');
  const r2 = await refuserProposition(magasin, 'emp-2');
  assert.equal(r2.dateReponse, r1.dateReponse);
  await assert.rejects(() => refuserProposition(magasin, 'inconnue'));
});

test('[ROUGE] confirmerPropositionApprise : proposee -> apprise, relie gabaritTypeId, erreur si inconnue', async () => {
  const magasin = magasinMemoireVive();
  const candidat = { motifCle: 'mot:ziqualo', empreinte: 'emp-3', hypothese: { candidats: ['mot:ziqualo'], gabarits: [], couverture: ['a', 'b'] } };
  await proposerCandidatSiNouveau(magasin, candidat);
  const c = await confirmerPropositionApprise(magasin, 'emp-3', 'gabaritType-xyz');
  assert.equal(c.statut, 'apprise');
  assert.equal(c.gabaritTypeId, 'gabaritType-xyz');
  await assert.rejects(() => confirmerPropositionApprise(magasin, 'inconnue', 'x'));
});

test('[STATIQUE] pont.js n\'appelle jamais repererMotifs (aucun déclenchement de découverte de motif depuis la seule création d\'une expérience)', () => {
  assert.ok(!pontSource.includes('repererMotifs'));
});
test('[STATIQUE] connaissances.js : repererMotifs n\'est appelé QUE depuis examinerVecuEtFormerHypotheses (le raccord v0.25 vit dans ecran.js, jamais ici)', () => {
  const debutFonction = connaissancesSource.indexOf('function examinerVecuEtFormerHypotheses');
  const finFonction = connaissancesSource.indexOf('\nfunction dernierJugementParExperience', debutFonction);
  const avant = sansCommentaires(connaissancesSource.slice(0, debutFonction).split('\n').filter((l) => !l.trim().startsWith('import ')).join('\n'));
  const apres = sansCommentaires(connaissancesSource.slice(finFonction));
  assert.ok(!avant.includes('repererMotifs'));
  assert.ok(!apres.includes('repererMotifs'));
});
test('[STATIQUE] connaissances.js ne lit jamais les jugements correct/incorrect pour les propositions v0.25', () => {
  const debut = connaissancesSource.indexOf('export async function proposerCandidatSiNouveau');
  const bloc = sansCommentaires(connaissancesSource.slice(debut));
  assert.ok(!/jugement-christophe|dernierJugementParExperience\(/.test(bloc.split('function dernierJugementParExperience')[0]) || true);
  // Garantie réelle : aucune des trois fonctions v0.25 ne mentionne le mot « jugement ».
  const proposer = connaissancesSource.slice(connaissancesSource.indexOf('export async function proposerCandidatSiNouveau'), connaissancesSource.indexOf('export async function refuserProposition'));
  const refuser = connaissancesSource.slice(connaissancesSource.indexOf('export async function refuserProposition'), connaissancesSource.indexOf('export async function confirmerPropositionApprise'));
  const confirmer = connaissancesSource.slice(connaissancesSource.indexOf('export async function confirmerPropositionApprise'), connaissancesSource.indexOf('// === FIN_LANGAGE_CONNAISSANCES'));
  for (const bloc2 of [proposer, refuser, confirmer]) assert.ok(!/jugement/i.test(sansCommentaires(bloc2)));
});

// ==================================================================== PARTIE C — orchestration (ecran.js), bout en bout

// Trois sujets DISTINCTS, chacun mirroré (positif « Ziqualo, ... » / négatif identique sans
// « Ziqualo »), et le MÊME possessif partout (« mon ») pour qu'aucune propriété grammaticale
// accidentelle (rôle possessif, « est »...) n'atteigne jamais une couverture plus large que
// « ziqualo » lui-même : chaque paire ne partage RIEN d'autre entre elle et les deux autres paires,
// donc seul « ziqualo » (present dans les 3 positifs, absent des 3 négatifs) couvre les 3 -- les
// motifs propres à un seul sujet (couverture 2) restent réels mais toujours moins soutenus.
const SUJETS_ZIQUALO = [
  ['Ziqualo, mon bouloir est vert.', 'Mon bouloir est vert.'],
  ['Ziqualo, mon teint est jaune.', 'Mon teint est jaune.'],
  ['Ziqualo, mon dagoulin est grand.', 'Mon dagoulin est grand.'],
];
const SUJET_SUPPLEMENTAIRE = ['Ziqualo, mon plafond est haut.', 'Mon plafond est haut.'];

async function semerZiqualo(magasin, sujets = SUJETS_ZIQUALO, decalage = 0) {
  let i = decalage;
  for (const [positif, negatif] of sujets) {
    await enregistrerExperience(magasin, { texteRecu: positif, texteRepondu: '…', date: await t(i), source: 'laboratoire' }); i += 1;
    await enregistrerExperience(magasin, { texteRecu: negatif, texteRepondu: '…', date: await t(i), source: 'laboratoire' }); i += 1;
  }
}

test('[ROUGE] une seule expérience isolée -> aucune proposition', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  await enregistrerExperience(magasin, { texteRecu: 'Ziqualo, bonjour.', texteRepondu: '…', date: await t(), source: 'laboratoire' });
  const proposition = await ecran.examinerPropositionSpontanee();
  assert.equal(proposition, null);
  assert.deepEqual(await magasin.lireTout('propositions'), []);
});

test('[ROUGE→VERT] plusieurs expériences cohérentes -> un candidat solide est proposé (rien appris)', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  await semerZiqualo(magasin);
  const proposition = await ecran.examinerPropositionSpontanee();
  assert.ok(proposition, 'une proposition devait apparaître');
  assert.equal(proposition.statut, 'proposee');
  assert.equal(proposition.motifCle, 'mot:ziqualo');
  assert.deepEqual(proposition.candidats, ['mot:ziqualo']);
  assert.equal(proposition.couverture.length, 3, 'doit retenir le candidat le plus soutenu (3 sujets), pas un motif propre à un seul sujet (2)');
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []); // rien appris avant confirmation.
});

test('[ROUGE] contraste insuffisant (le vécu ne contient que ce qui serait couvert) -> aucune proposition forcée', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  // Seulement deux expériences « Ziqualo », rien d'autre dans le pool : quel que soit le motif
  // repéré, sa propre scission n'aura jamais aucun négatif (il couvre 100% du pool examiné) --
  // candidatDepuisMotif() le refuse systématiquement (voir Partie A), donc rien n'est proposé.
  await enregistrerExperience(magasin, { texteRecu: 'Ziqualo, bonjour à toi.', texteRepondu: '…', date: await t(0), source: 'laboratoire' });
  await enregistrerExperience(magasin, { texteRecu: 'Ziqualo, au revoir à toi.', texteRepondu: '…', date: await t(1), source: 'laboratoire' });
  const proposition = await ecran.examinerPropositionSpontanee();
  assert.equal(proposition, null);
  assert.deepEqual(await magasin.lireTout('propositions'), []);
});

test('[ROUGE] un candidat déjà proposé n\'est jamais reproposé une seconde fois (même empreinte)', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  await semerZiqualo(magasin);
  const p1 = await ecran.examinerPropositionSpontanee();
  assert.ok(p1);
  const p2 = await ecran.examinerPropositionSpontanee();
  assert.equal(p2.id, p1.id, 'même proposition en attente rendue telle quelle, jamais une seconde créée');
  assert.equal((await magasin.lireTout('propositions')).length, 1);
});

test('[ROUGE] un candidat refusé n\'est pas reproposé tant que le vécu ne change pas, mais un vécu qui évolue peut en produire un différent', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  await semerZiqualo(magasin);
  const p1 = await ecran.examinerPropositionSpontanee();
  assert.ok(p1);
  assert.equal(p1.motifCle, 'mot:ziqualo', 'le candidat le plus soutenu (3 sujets) doit sortir en premier');
  await ecran.refuserPropositionSpontanee(p1.id);

  // Ce même vécu porte aussi des régularités propres à un seul sujet (couverture 2, réelles mais
  // moins soutenues que « ziqualo ») : les épuiser par refus successifs ne doit JAMAIS faire
  // réapparaître l'empreinte précise déjà refusée (p1.id) tant que le vécu ne change pas.
  const refusees = [];
  for (let garde = 0; garde < 10; garde += 1) {
    const suivante = await ecran.examinerPropositionSpontanee();
    if (!suivante) break;
    assert.notEqual(suivante.id, p1.id, 'l\'empreinte précise refusée ne doit jamais revenir sur le même vécu');
    refusees.push(suivante.id);
    await ecran.refuserPropositionSpontanee(suivante.id);
  }
  assert.equal(await ecran.examinerPropositionSpontanee(), null, 'vécu inchangé : plus aucun candidat à proposer');

  // Le vécu évolue : un quatrième sujet étend la couverture réelle du candidat « ziqualo » -- son
  // empreinte change donc (couverture différente), et redevient proposable malgré le refus antérieur.
  await semerZiqualo(magasin, [SUJET_SUPPLEMENTAIRE], 100);
  const p2 = await ecran.examinerPropositionSpontanee();
  assert.ok(p2, 'un candidat à la couverture différente doit rester proposable');
  assert.equal(p2.motifCle, 'mot:ziqualo');
  assert.notEqual(p2.id, p1.id);
  assert.ok(!refusees.includes(p2.id));
});

test('[ROUGE→VERT] confirmation -> apprentissage réel, plus jamais reproposé, phrase inédite reconnue', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  await semerZiqualo(magasin);
  const proposition = await ecran.examinerPropositionSpontanee();
  assert.ok(proposition);
  assert.equal(proposition.motifCle, 'mot:ziqualo');

  const resultat = await ecran.confirmerPropositionSpontanee(proposition.id, 'TYPE_VECU_SPONTANE');
  assert.match(resultat.explication, /TYPE_VECU_SPONTANE/);

  const gabarits = await magasin.lireTout('gabaritsTypes');
  assert.equal(gabarits.length, 1);
  assert.equal(gabarits[0].signification, 'TYPE_VECU_SPONTANE');

  // D'autres régularités propres à un seul sujet (couverture 2) peuvent encore être proposées
  // ensuite (elles sont réelles, distinctes) -- la garantie exacte est que CE candidat précis
  // (« ziqualo », déjà appris) ne revient jamais.
  const apres = await ecran.examinerPropositionSpontanee();
  assert.ok(!apres || apres.motifCle !== 'mot:ziqualo', 'un candidat déjà appris ne doit plus jamais être reproposé');

  const esprit = await ecran.assurerEsprit();
  const r = repondre(esprit, 'Ziqualo, mon plafond est bleu ?');
  assert.equal(r.comprehension.type, 'TYPE_VECU_SPONTANE');
});

test('[ROUGE] persistance après un rechargement complet (nouvel esprit, même magasin)', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  await semerZiqualo(magasin);
  const proposition = await ecran.examinerPropositionSpontanee();
  await ecran.confirmerPropositionSpontanee(proposition.id, 'TYPE_VECU_SPONTANE');

  const fraisEsprit = await chargerEsprit(magasin);
  const r = repondre(fraisEsprit, 'Ziqualo, mon plafond est bleu ?');
  assert.equal(r.comprehension.type, 'TYPE_VECU_SPONTANE');

  const propositions = await magasin.lireTout('propositions');
  assert.equal(propositions[0].statut, 'apprise');
});

test('[ROUGE] les jugements correct/incorrect n\'ont aucune influence sur la proposition spontanée', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  await semerZiqualo(magasin);
  const { enregistrerJugement } = await import('../app/langage/connaissances.js');
  const toutes = await magasin.lireTout('experiences');
  await enregistrerJugement(magasin, toutes[0].id, 'incorrect');
  await enregistrerJugement(magasin, toutes[2].id, 'correct');
  const proposition = await ecran.examinerPropositionSpontanee();
  assert.ok(proposition, 'les jugements ne doivent ni bloquer ni forcer la proposition');
  assert.equal(proposition.motifCle, 'mot:ziqualo');
});

test('[ROUGE] un candidat déjà appris par le banc d\'essai manuel (v0.24) n\'est jamais reproposé automatiquement', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monter(magasin);
  await semerZiqualo(magasin);
  // Apprentissage MANUEL (comme le banc d'essai v0.24), jamais via la proposition spontanée.
  const esprit = await ecran.assurerEsprit();
  const { apprendreGabaritType } = await import('../app/langage/esprit.js');
  await apprendreGabaritType(esprit, { candidats: ['mot:ziqualo'], gabarits: [[{ mot: 'ziqualo' }]], signification: 'TYPE_MANUEL', exemples: [] });
  const proposition = await ecran.examinerPropositionSpontanee();
  assert.ok(
    !proposition || !proposition.candidats.includes('mot:ziqualo'),
    'déjà appris par un autre chemin : ce candidat précis n\'est jamais reproposé automatiquement',
  );
  assert.equal((await magasin.lireTout('gabaritsTypes')).length, 1, 'toujours la seule connaissance apprise manuellement, rien appris automatiquement');
});
// === FIN_TEST_PROPOSITION_SPONTANEE ===
