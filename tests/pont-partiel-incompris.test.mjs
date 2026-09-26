// === DEBUT_TEST_PONT_PARTIEL_INCOMPRIS ===
// TESTS ROUGES D'ABORD — aucune implémentation n'existe encore pour cette partie.
//
// Objectif (feu vert « Conserver dans B1 le vécu réel PARTIEL / INCOMPRIS ») : quand une vraie
// conversation contenant « ? » produit une tentative langage PARTIEL ou INCOMPRIS, conserver ce
// tour dans B1 comme un événement réellement vécu -- texteRecu réel, texteRepondu RÉELLEMENT montré
// (jamais PHRASE_INCOMPRIS), date réelle, referenceMemoire = IDs réels du VRAI échange déjà
// enregistré par le chemin LLM (aucune seconde écriture mémoire), interprétation append-only
// portant l'état PARTIEL/INCOMPRIS et les données de compréhension déjà calculées par l'UNIQUE
// appel à repondre() fait dans tenterPontLangage() -- jamais un second appel au moteur langage.
//
// Architecture retenue (cohérente avec A1/A2, déjà dans pont.js) : une seconde fonction exportée,
// enregistrerExperienceTentativeEchouee(texte, tentative, reponse, deps), testable en isolation,
// appelée par main.js APRÈS le fallback LLM -- jamais par tenterPontLangage() lui-même, qui ne
// connaît pas encore la réponse réelle à cet instant (donc n'écrit toujours rien prématurément).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tenterPontLangage, enregistrerExperienceTentativeEchouee } from '../app/langage/pont.js';
import { chargerEsprit } from '../app/langage/esprit.js';
import { repererMotifs } from '../app/langage/induction.js';
import {
  magasinMemoireVive, enregistrerExperience, ajouterInterpretation,
} from '../app/langage/connaissances.js';

async function faux() {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const sequence = [];
  const deps = {
    assurerEsprit: async () => e,
    journaliser: async () => { sequence.push('journaliser'); return [null, null]; },
    enregistrerExperience: async (donnees) => { sequence.push('enregistrerExperience'); return enregistrerExperience(magasin, donnees); },
    ajouterInterpretation: async (id, donnees) => { sequence.push('ajouterInterpretation'); return ajouterInterpretation(magasin, id, donnees); },
  };
  return { magasin, deps, sequence };
}

// « Mon gadget ? » -> PARTIEL (sujet trouvé, relation inconnue). « Zorglub ? » -> INCOMPRIS (ni
// l'un ni l'autre). Vérifié sur le vrai moteur (voir tests/pont-langage.test.mjs).
const REPONSE_LLM = {
  texte: 'Je ne connais pas encore ce mot, tu peux m\'en dire plus ?',
  idQuestion: 41, idReponse: 99, dateQuestion: '2026-09-26T08:00:00.000Z',
};

for (const [libelle, phrase, etatAttendu] of [
  ['PARTIEL', 'Mon gadget ?', 'partiel'],
  ['INCOMPRIS', 'Zorglub ?', 'incompris'],
]) {
  test(`[ROUGE ${libelle}] la tentative n'est pas perdue : tenterPontLangage() la transmet`, async () => {
    const f = await faux();
    const r = await tenterPontLangage(phrase, f.deps);
    assert.ok(r && r.tentative, 'une tentative doit être transmise, jamais null');
    assert.equal(r.tentative.etat, etatAttendu);
  });

  test(`[ROUGE ${libelle}] le fallback LLM reste utilisé : la tentative n'est jamais "locale finale"`, async () => {
    const f = await faux();
    const r = await tenterPontLangage(phrase, f.deps);
    // C'est exactement ce que teste main.js pour décider s'il appelle esprit.repondre() (LLM) :
    // si ce champ était accidentellement vrai, le fallback ne serait jamais déclenché.
    assert.notEqual(r.local, true);
  });

  test(`[ROUGE ${libelle}] B1 reçoit le texte utilisateur réel`, async () => {
    const f = await faux();
    const r = await tenterPontLangage(phrase, f.deps);
    const exp = await enregistrerExperienceTentativeEchouee(phrase, r.tentative, REPONSE_LLM, f.deps);
    assert.equal(exp.texteRecu, phrase);
  });

  test(`[ROUGE ${libelle}] B1 reçoit la réponse LLM réellement montrée, jamais la phrase-type interne`, async () => {
    const f = await faux();
    const r = await tenterPontLangage(phrase, f.deps);
    const exp = await enregistrerExperienceTentativeEchouee(phrase, r.tentative, REPONSE_LLM, f.deps);
    assert.equal(exp.texteRepondu, REPONSE_LLM.texte);
    assert.notEqual(exp.texteRepondu, "Je n'ai pas compris.");
  });

  test(`[ROUGE ${libelle}] l'interprétation conserve l'état ${etatAttendu} et les données de compréhension`, async () => {
    const f = await faux();
    const r = await tenterPontLangage(phrase, f.deps);
    const exp = await enregistrerExperienceTentativeEchouee(phrase, r.tentative, REPONSE_LLM, f.deps);
    assert.equal(exp.interpretations.length, 1);
    const interp = exp.interpretations[0];
    assert.equal(interp.origine, 'comprendre');
    assert.equal(interp.donnees.etat, etatAttendu);
    assert.deepEqual(interp.donnees, r.tentative.comprehension);
  });

  test(`[ROUGE ${libelle}] referenceMemoire porte exactement idQuestion + idReponse du vrai échange (non adjacents)`, async () => {
    const f = await faux();
    const r = await tenterPontLangage(phrase, f.deps);
    const exp = await enregistrerExperienceTentativeEchouee(phrase, r.tentative, REPONSE_LLM, f.deps);
    assert.deepEqual(exp.referenceMemoire, { idQuestion: 41, idReponse: 99 });
  });

  test(`[ROUGE ${libelle}] date = la date réelle du tour (dateQuestion du vrai échange)`, async () => {
    const f = await faux();
    const r = await tenterPontLangage(phrase, f.deps);
    const exp = await enregistrerExperienceTentativeEchouee(phrase, r.tentative, REPONSE_LLM, f.deps);
    assert.equal(exp.date, REPONSE_LLM.dateQuestion);
  });

  test(`[ROUGE ${libelle}] aucune seconde écriture de l'échange dans naissance-memoire : jamais journalisé ici`, async () => {
    const f = await faux();
    const r = await tenterPontLangage(phrase, f.deps);
    await enregistrerExperienceTentativeEchouee(phrase, r.tentative, REPONSE_LLM, f.deps);
    assert.equal(f.sequence.includes('journaliser'), false);
  });
}

// -------------------------------------------------------------------- C — COMPRIS inchangé
test('[ROUGE C] le chemin COMPRIS existant reste inchangé (comportement visible)', async () => {
  const f = await faux();
  const { apprendreRelation, apprendreFait } = await import('../app/langage/esprit.js');
  const e = await f.deps.assurerEsprit();
  await apprendreRelation(e, { mot: 'manteau', relation: 'manteau' });
  await apprendreFait(e, { sujet: 'moi', relation: 'manteau', valeur: 'un manteau bleu' });
  const r = await tenterPontLangage('Quel est mon manteau ?', f.deps);
  assert.deepEqual(r, { texte: 'un manteau bleu', local: true, laboratoire: true });
});

test('[ROUGE C] COMPRIS écrit toujours une seule expérience, comme avant', async () => {
  const f = await faux();
  const { apprendreRelation, apprendreFait } = await import('../app/langage/esprit.js');
  const e = await f.deps.assurerEsprit();
  await apprendreRelation(e, { mot: 'manteau', relation: 'manteau' });
  await apprendreFait(e, { sujet: 'moi', relation: 'manteau', valeur: 'un manteau bleu' });
  await tenterPontLangage('Quel est mon manteau ?', f.deps);
  assert.equal((await f.magasin.lireTout('experiences')).length, 1);
});

// -------------------------------------------------------------------- D — compatibilité B3a
test('[ROUGE D] une expérience PARTIEL/INCOMPRIS nouvellement conservée est vue par repererMotifs() sans modification de B3a', async () => {
  const f = await faux();
  const r1 = await tenterPontLangage('Mon gadget ?', f.deps);
  await enregistrerExperienceTentativeEchouee('Mon gadget bleu, mon gadget ?', r1.tentative, { ...REPONSE_LLM, idQuestion: 1, idReponse: 2 }, f.deps);
  const r2 = await tenterPontLangage('Ce gadget ?', f.deps);
  await enregistrerExperienceTentativeEchouee('Ce gadget rouge, ce gadget ?', r2.tentative, { ...REPONSE_LLM, idQuestion: 3, idReponse: 4 }, f.deps);
  const toutes = await f.magasin.lireTout('experiences');
  const entrees = toutes.map((exp) => ({ id: exp.id, texteRecu: exp.texteRecu }));
  const motifs = repererMotifs(entrees, { lexique: (await f.deps.assurerEsprit()).lexique });
  const motifGadget = motifs.find((m) => m.cle === 'mot:gadget');
  assert.ok(motifGadget, 'le motif "gadget", commun aux deux expériences PARTIEL/INCOMPRIS, doit être repéré');
  assert.equal(motifGadget.couverture.length, 2);
});

// -------------------------------------------------------------------- garde-fous statiques
test('[STATIQUE] enregistrerExperienceTentativeEchouee ne référence jamais journaliser/ajouterEchange (aucune seconde écriture mémoire possible)', () => {
  const src = fs.readFileSync(new URL('../app/langage/pont.js', import.meta.url), 'utf8');
  const debut = src.indexOf('export async function enregistrerExperienceTentativeEchouee');
  assert.ok(debut > 0);
  const fin = src.indexOf('\n}', debut);
  const corps = src.slice(debut, fin);
  assert.ok(!corps.includes('journaliser'));
  assert.ok(!corps.includes('ajouterEchange'));
});

test('[STATIQUE] toujours exactement un appel à repondre( dans pont.js (aucun second calcul introduit)', () => {
  const src = fs.readFileSync(new URL('../app/langage/pont.js', import.meta.url), 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const occurrences = (sansCommentaires.match(/repondre\(/g) || []).length;
  assert.equal(occurrences, 1);
});

// -------------------------------------------------------------------- garde-fous statiques : main.js
// main.js n'a AUCUNE couverture comportementale nulle part dans le dépôt (confirmé par grep : sa
// fermeture `conversation.repondre` n'est jamais invoquée par un test, seule sa forme injectée
// `repondreFn` dans tests/ecrans-contrats.test.mjs l'est). C'est le même constat qui a motivé A1
// (extraction de tenterPontLangage() dans pont.js). Les garanties suivantes ne peuvent donc être
// vérifiées ici que par lecture statique du source de main.js.
function corpsRepondreMain() {
  const src = fs.readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
  const debut = src.indexOf('repondre: async (texte, options) => {');
  assert.ok(debut > 0, 'la fermeture conversation.repondre doit exister telle quelle');
  const finFonction = src.indexOf('\n  },\n  chargerRecents:', debut);
  assert.ok(finFonction > debut, 'la fin de la fermeture doit être repérable');
  return src.slice(debut, finFonction);
}

test('[STATIQUE] main.js ne retourne la tentative locale comme réponse finale que si local.local est vrai (jamais sur local seul)', () => {
  const corps = corpsRepondreMain();
  assert.match(corps, /if\s*\(\s*local\s*&&\s*local\.local\s*\)\s*return local;/,
    'PARTIEL/INCOMPRIS (local.tentative, sans local.local) ne doit jamais emprunter ce retour anticipé');
});

test('[STATIQUE] main.js enregistre la tentative échouée seulement quand local.tentative existe', () => {
  const corps = corpsRepondreMain();
  assert.match(corps, /if\s*\(\s*local\s*&&\s*local\.tentative\s*\)\s*\{/,
    'sans cette garde, soit toute réponse locale serait ré-enregistrée, soit la tentative serait perdue');
});

test('[STATIQUE] main.js appelle esprit.repondre(...) AVANT enregistrerExperienceTentativeEchouee (jamais avec une réponse pas encore connue)', () => {
  const corps = corpsRepondreMain();
  const iEspritRepondre = corps.indexOf('await esprit.repondre(texte, options)');
  const iEnregistrer = corps.indexOf('await enregistrerExperienceTentativeEchouee(');
  assert.ok(iEspritRepondre > 0 && iEnregistrer > 0, 'les deux appels doivent exister');
  assert.ok(iEspritRepondre < iEnregistrer, 'la réponse réelle doit être connue avant d’être conservée dans B1');
});

test('[STATIQUE] main.js transmet exactement (texte, local.tentative, reponse, experienceDeps) — jamais une valeur recalculée ou substituée', () => {
  const corps = corpsRepondreMain();
  assert.match(corps, /enregistrerExperienceTentativeEchouee\(texte, local\.tentative, reponse, experienceDeps\)/,
    'un mauvais rattachement (ex: passer local au lieu de reponse) romprait le lien avec le VRAI échange mémoire déjà écrit');
});
// === FIN_TEST_PONT_PARTIEL_INCOMPRIS ===
