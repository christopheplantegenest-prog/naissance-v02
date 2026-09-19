import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererPlan, estimerDuree, EXPERIENCES } from '../app/moteur-local/grand-banc-plan.js';
import { executerLot, rapportSynthese, rapportBrut, TAILLE_LOT_PAR_DEFAUT } from '../app/moteur-local/grand-banc.js';
import { classerAbsence, classerCompletion } from '../app/moteur-local/grand-banc-classement.js';
import { classer } from '../app/moteur-local/classement.js';
import { magasinMemoireVive } from '../app/moteur-local/grand-banc-stockage.js';

const IDENTITE = { personne: 'Christophe', ia: 'Naissance' };

test('plan : déterministe, identifiants uniques, toutes les expériences présentes, volume raisonnable', () => {
  const p1 = genererPlan();
  const p2 = genererPlan();
  assert.deepEqual(p1.map((e) => e.id), p2.map((e) => e.id), 'même plan à chaque appel : la reprise en dépend');
  assert.equal(new Set(p1.map((e) => e.id)).size, p1.length, 'aucun identifiant en double');
  for (const exp of Object.keys(EXPERIENCES)) {
    assert.ok(p1.some((e) => e.experience === exp), `expérience ${exp} présente dans le plan`);
  }
  assert.ok(p1.length >= 100 && p1.length <= 220, `volume raisonnable : ${p1.length} essais`);
  const identite = p1.filter((e) => e.experience === 'identite');
  assert.ok(identite.some((e) => e.sansIdentite) && identite.some((e) => e.identiteCourte) && identite.some((e) => !e.sansIdentite && !e.identiteCourte), 'les trois conditions d’identité sont représentées');
  const personne = p1.filter((e) => e.experience === 'personne');
  const graines = new Set(personne.filter((e) => e.condition.endsWith('-1re')).map((e) => e.graine));
  const grainesToi = new Set(personne.filter((e) => e.condition.endsWith('-2e')).map((e) => e.graine));
  assert.deepEqual(graines, grainesToi, 'mêmes graines entre les formulations, comme demandé');
});

test('estimation de durée : cohérente avec le volume du plan', () => {
  const plan = genererPlan();
  const e = estimerDuree(plan);
  assert.equal(e.essais, plan.length);
  assert.ok(e.secondesBasses > 0 && e.secondesHautes > e.secondesBasses);
  assert.ok(e.secondesHautes / 60 < 120, 'estimation restant dans un ordre de grandeur raisonnable (moins de 2 h)');
});

// --- moteur factice : répond selon un scénario, mesure fixe ---
const MESURES = { cache: 'mémoire', jetonsPrefixe: 90, jetonsSuite: 60, jetonsEcrits: 20, premierMotMs: 3000, lectureJps: 18, ecritureJps: 8, fin: 'naturelle', graine: null };
function moteurDeTest(reponsePour) {
  return async (ligneEssai) => {
    if (ligneEssai.id === 'echoue') throw new Error('Mémoire insuffisante pour le moteur local.');
    const texte = reponsePour(ligneEssai);
    const souvenirsTrace = (ligneEssai.souvenirsImposes || []).map((s, i) => ({ id: `i${i}`, texte: s, statut: 'imposé', motsCommuns: ['(imposé)'] }));
    return {
      texte,
      mesures: { ...MESURES, graine: ligneEssai.graine ?? null },
      contexte: {
        prefixe: ligneEssai.sansIdentite ? 'Nous sommes le jeudi.' : "Tu es Naissance, l'IA de Christophe.",
        elements: [{ role: 'moi', texte: ligneEssai.question }],
        estimation: { total: 150 },
        souvenirsTrace,
      },
    };
  };
}

test('executerLot : reprise — un essai déjà dans le journal n’est jamais refait', async () => {
  const plan = genererPlan().slice(0, 5);
  const m = magasinMemoireVive();
  const vus = [];
  const essai = async (e) => { vus.push(e.id); return moteurDeTest(() => 'Tu habites à Marcillac-Lanville.')(e); };
  await m.enregistrerEssai({ id: plan[0].id, succes: true });
  await m.enregistrerEssai({ id: plan[1].id, succes: true });
  const dejaFaits = new Set((await m.listerEssais()).map((x) => x.id));
  const r = await executerLot({ plan, dejaFaits, essai, enregistrer: (rec) => m.enregistrerEssai(rec), identite: IDENTITE, tailleLot: 10 });
  assert.deepEqual(vus, plan.slice(2).map((e) => e.id), 'seuls les essais absents du journal sont exécutés');
  assert.equal(r.traites, 3);
  assert.equal((await m.listerEssais()).length, 5);
});

test('executerLot : chaque essai est enregistré immédiatement, une panne au 3e n’efface pas les 2 premiers', async () => {
  const plan = genererPlan().slice(0, 4).map((e, i) => (i === 2 ? { ...e, id: 'echoue' } : e));
  const m = magasinMemoireVive();
  let enregistres = 0;
  const original = m.enregistrerEssai.bind(m);
  m.enregistrerEssai = async (rec) => { enregistres++; return original(rec); };
  const essai = moteurDeTest(() => 'Tu habites à Marcillac-Lanville.');
  await executerLot({ plan, dejaFaits: new Set(), essai, enregistrer: (rec) => m.enregistrerEssai(rec), identite: IDENTITE, tailleLot: 4 });
  assert.equal(enregistres, 4, 'un enregistrement par essai, y compris l’échec');
  const faits = await m.listerEssais();
  assert.equal(faits.find((f) => f.id === 'echoue').succes, false);
  assert.match(faits.find((f) => f.id === 'echoue').erreur, /Mémoire insuffisante/);
  assert.ok(faits.filter((f) => f.succes).length === 3);
});

test('executerLot : s’arrête proprement entre deux essais, respecte la taille de lot', async () => {
  const plan = genererPlan().slice(0, 20);
  const m = magasinMemoireVive();
  let n = 0;
  const essai = async (e) => { n++; if (n === 3) arret = true; return moteurDeTest(() => 'x')(e); };
  let arret = false;
  const r1 = await executerLot({ plan, dejaFaits: new Set(), essai, enregistrer: (rec) => m.enregistrerEssai(rec), identite: IDENTITE, tailleLot: 6, arret: () => arret });
  assert.ok(r1.traites <= 3, 'arrêt respecté avant la fin du lot');
  assert.equal(r1.termine, false);
  const r2 = await executerLot({ plan, dejaFaits: new Set((await m.listerEssais()).map((x) => x.id)), essai: moteurDeTest(() => 'x'), enregistrer: (rec) => m.enregistrerEssai(rec), identite: IDENTITE, tailleLot: 6 });
  assert.equal(r2.traites, 6, 'lot suivant : taille normale, reprend après les essais déjà faits');
});

test('executerLot : le nom réel de la personne est utilisé pour le classement (pas « la personne »)', async () => {
  const plan = genererPlan().filter((e) => e.id === 'variabilite/fixe/1');
  const m = magasinMemoireVive();
  const essai = moteurDeTest(() => 'Je suis Naissance de Christophe, donc j’habite à Marcillac-Lanville.');
  await executerLot({ plan, dejaFaits: new Set(), essai, enregistrer: (rec) => m.enregistrerEssai(rec), identite: IDENTITE, tailleLot: 1 });
  const [rec] = await m.listerEssais();
  assert.equal(rec.categorie, 'confusion-roles', 'sans le vrai prénom, ce motif ne se déclenche jamais — bug corrigé au passage en v0.7.3');
});

test('classerAbsence : les six cas demandés, distingués correctement (plusieurs marqueurs possibles, comme prévu)', () => {
  const ctx = { prefixe: 'P', elements: [{ role: 'moi', texte: 'q' }], estimation: { total: 10 }, souvenirsTrace: [] };
  const epreuve = { sujet: 'personne', attendu: 'ignorance' };
  const cas = (reponse) => classerAbsence(classer({ epreuve, reponse, contexte: ctx, identite: IDENTITE }), reponse);
  assert.deepEqual(cas('Je ne sais pas.'), ['aveu']);
  assert.deepEqual(cas('Je ne répondrai pas.'), ['refus']);
  assert.ok(cas('Tu chausses du 43.').includes('invention'));
  assert.ok(cas('Je peux imaginer que tu conduis une petite voiture, par exemple.').includes('imaginaire'));
  assert.ok(!cas('Je peux imaginer que tu conduis une petite voiture, par exemple.').includes('invention'), 'une hypothèse assumée ne compte pas comme invention factuelle');
  assert.ok(cas('Tu me demandes quoi exactement ?').includes('clarification'));
});

test('classerCompletion : distingue arrêt, remplissage, géographie, autre fait', () => {
  const trace = [{ id: 's', texte: 'Christophe habite à Marcillac-Lanville.', statut: 'imposé', motsCommuns: ['(imposé)'] }];
  const ctx = {
    prefixe: 'P',
    elements: [{ role: 'systeme', texte: 'Christophe habite à Marcillac-Lanville.' }, { role: 'moi', texte: "Où est-ce que j'habite ?" }],
    estimation: { total: 10 },
    souvenirsTrace: trace,
  };
  const epreuve = { sujet: 'personne', attendu: 'fait' };
  const c = (reponse) => classerCompletion(classer({ epreuve, reponse, contexte: ctx, identite: IDENTITE }));
  assert.deepEqual(c('Tu habites à Marcillac-Lanville.'), ['arretee']);
  assert.deepEqual(c('Tu habites à Marcillac-Lanville, en Bourgogne.'), ['geographique']);
  assert.deepEqual(c('Tu habites à Marcillac-Lanville, une charmante petite bourgade.'), ['stylistique']);
});

test('rapports : synthèse et données brutes lisibles, échecs comptés, aucune réponse supprimée', () => {
  const plan = genererPlan().filter((e) => e.experience === 'variabilite');
  const c = classer({ epreuve: plan[0], reponse: 'Tu habites à Marcillac-Lanville.', contexte: { prefixe: 'P', elements: [], estimation: { total: 10 }, souvenirsTrace: [{ id: 's', texte: 'x', statut: 'imposé', motsCommuns: [] }] }, identite: IDENTITE });
  const essais = [
    { id: plan[0].id, experience: 'variabilite', condition: 'graine-fixe', repetition: 1, date: 'd', question: plan[0].question, succes: true, reponseBrute: 'Tu habites à Marcillac-Lanville.', categorie: c.categorie, prefixeEnvoye: 'P', graineDemandee: 100, graineUtilisee: 100, cache: 'mémoire', premierMotMs: 3000, ecritureJps: 8, dureeTotaleMs: 5000, raisonFin: 'naturelle', jetonsContexteEstimes: 150, souvenirsImposes: plan[0].souvenirsImposes, sansSouvenirs: false },
    { id: 'x', experience: 'variabilite', condition: 'graine-fixe', repetition: 2, date: 'd', question: plan[0].question, succes: false, erreur: 'Mémoire insuffisante' },
  ];
  const synthese = rapportSynthese({ plan, essais });
  assert.match(synthese, /2 réalisé\(s\), 1 échec\(s\) technique\(s\)/);
  const brut = rapportBrut({ essais });
  assert.match(brut, /Tu habites à Marcillac-Lanville\./);
  assert.match(brut, /ERREUR : Mémoire insuffisante/, 'un échec reste visible dans les données brutes, jamais supprimé');
});
