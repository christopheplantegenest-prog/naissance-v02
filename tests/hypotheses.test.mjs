// === DEBUT_TEST_HYPOTHESES ===
// CHANTIER REFONDU (décision ChatGPT du 26/09/2026, « SIGNAL D'APPRENTISSAGE ») — ce fichier
// REMPLACE ENTIÈREMENT sa version précédente (formerHypotheses/confronterHypothese, retirées :
// elles mettaient en relation deux sorties SIMULTANÉES du même appel à comprendre() -- sujet/
// relation/type/motsInconnus et l'état qui en est directement dérivé -- ce qui n'était jamais une
// vraie prédiction, seulement une relecture d'une règle déjà codée. Diagnostic détaillé envoyé à
// ChatGPT et accepté : voir les rapports de continuité correspondants.
//
// NOUVELLE ARCHITECTURE : une hypothèse relie désormais deux informations RÉELLEMENT indépendantes :
// - une CONDITION observable AVANT tout résultat : un motif structurel du texte reçu (repererMotifs(),
//   qui n'appelle jamais comprendre()) ;
// - un RÉSULTAT observable APRÈS, et jamais déduit par comprendre()/repondre() : un JUGEMENT humain
//   facultatif, 'correct' ou 'incorrect', ajouté par Christophe (voir connaissances.js,
//   enregistrerJugement()) à un moment ultérieur, potentiellement bien après l'échange.
//
// formerHypothesesJugement(motifs, jugementParId) et confronterAttente(attendu, jugementReel),
// pures et isolées dans induction.js, REMPLACENT formerHypotheses()/confronterHypothese().
// enregistrerHypotheseSiNouvelle() (connaissances.js, INCHANGÉE -- déjà générique, aucune
// modification nécessaire) et confronterEtEnregistrer() (connaissances.js, adaptée pour comparer
// l'attente figée de l'hypothèse au jugement reçu, au lieu de rejouer une comparaison de champs)
// réutilisent TELLE QUELLE l'infrastructure de persistance (idempotence, historique des
// confrontations, statuts proposee/contredite) : voir la section PARTIE 3 ci-dessous.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  repererMotifs, repartirMotifsParEtat, chronologieMotifs, motifsAvecVariationDEtat, comparerMotifs,
  formerHypothesesJugement, confronterAttente,
} from '../app/langage/induction.js';
import {
  magasinMemoireVive, TABLES, enregistrerExperience, ajouterInterpretation,
  enregistrerHypotheseSiNouvelle, confronterEtEnregistrer, enregistrerJugement, enregistrerAttenteSiPertinente,
  confronterJugementEtEnregistrer,
} from '../app/langage/connaissances.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const induireSource = readFileSync(join(RACINE_APP, 'langage', 'induction.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// ======================================================================= PARTIE 1 — formerHypothesesJugement() (induction.js, pure)
const MOTIF = { gabarit: [{ mot: 'comment' }], cle: 'mot:comment', couverture: ['e1', 'e2', 'e3'] };

test('[ROUGE] une hypothèse porte une attente univoque quand tous les jugements connus concordent', () => {
  const jugements = new Map([['e1', 'correct'], ['e2', 'correct']]); // e3 jamais jugé -- absent, jamais fabriqué
  const [h] = formerHypothesesJugement([MOTIF], jugements);
  assert.equal(h.id, 'hyp:mot:comment');
  assert.equal(h.motifCle, 'mot:comment');
  assert.equal(h.attente, 'correct');
  assert.deepEqual(h.provenance.sort(), ['e1', 'e2']);
});

test('[ROUGE] aucune majorité arbitraire : des jugements contradictoires laissent attente=null (aucun tri par fréquence)', () => {
  const jugements = new Map([['e1', 'correct'], ['e2', 'incorrect'], ['e3', 'correct']]);
  const [h] = formerHypothesesJugement([MOTIF], jugements);
  assert.equal(h.attente, null, 'deux valeurs différentes coexistent : aucune attente déterminée, jamais la plus fréquente choisie');
  assert.deepEqual(h.provenance.sort(), ['e1', 'e2', 'e3']);
});

test('[ROUGE] un motif sans AUCUN jugement ne produit aucune hypothèse', () => {
  const hyps = formerHypothesesJugement([MOTIF], new Map());
  assert.deepEqual(hyps, []);
});

test('[ROUGE] un id jugé absent du motif (hors couverture) n\'entre jamais dans une hypothèse de ce motif', () => {
  const jugements = new Map([['e1', 'correct'], ['e-hors-motif', 'incorrect']]);
  const [h] = formerHypothesesJugement([MOTIF], jugements);
  assert.ok(!h.provenance.includes('e-hors-motif'));
});

test('[ROUGE] traçabilité exacte : observations porte chaque id jugé avec son jugement, rien de plus', () => {
  const jugements = new Map([['e1', 'correct'], ['e2', 'correct']]);
  const [h] = formerHypothesesJugement([MOTIF], jugements);
  assert.deepEqual(
    h.observations.slice().sort((a, b) => (a.id < b.id ? -1 : 1)),
    [{ id: 'e1', jugement: 'correct' }, { id: 'e2', jugement: 'correct' }],
  );
});

test('[ROUGE] formerHypothesesJugement prend EXACTEMENT deux paramètres (aucun seuil ajouté)', () => {
  assert.equal(formerHypothesesJugement.length, 2);
});

test('[ROUGE] appelée deux fois de suite sur les mêmes entrées, formerHypothesesJugement rend le même résultat', () => {
  const jugements = new Map([['e1', 'correct'], ['e2', 'correct']]);
  const r1 = formerHypothesesJugement([MOTIF], jugements);
  const r2 = formerHypothesesJugement([MOTIF], jugements);
  assert.deepEqual(r1, r2);
});

test('[STATIQUE] formerHypothesesJugement n\'appelle jamais comprendre()/repondre()/induire()/apprendreGabaritType()', () => {
  const debut = induireSource.indexOf('export function formerHypothesesJugement');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin));
  for (const interdit of ['comprendre(', 'repondre(', 'apprendreGabaritType(']) assert.ok(!corps.includes(interdit));
  assert.equal((corps.match(/(?<![a-zA-Zé])induire\(/g) || []).length, 0);
});

test('[STATIQUE] aucune notion de score/seuil/majorité/importance/récompense dans formerHypothesesJugement', () => {
  const debut = induireSource.indexOf('export function formerHypothesesJugement');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin)).toLowerCase();
  for (const interdit of ['score', 'confiance', 'important', 'cause', 'signification', 'recompense', 'récompense', 'majorite', 'majorité', 'frequent', 'fréquent']) {
    assert.ok(!corps.includes(interdit), `mot interdit trouvé : ${interdit}`);
  }
});

// ======================================================================= PARTIE 2 — confronterAttente() (induction.js, pure)
test('[ROUGE] aucune attente univoque (attendu=null) -> « insuffisant », jamais fabriqué', () => {
  assert.equal(confronterAttente(null, 'correct'), 'insuffisant');
});
test('[ROUGE] même valeur -> « compatible »', () => {
  assert.equal(confronterAttente('correct', 'correct'), 'compatible');
});
test('[ROUGE] valeur différente -> « incompatible »', () => {
  assert.equal(confronterAttente('correct', 'incorrect'), 'incompatible');
});
test('[ROUGE] confronterAttente prend EXACTEMENT deux paramètres', () => {
  assert.equal(confronterAttente.length, 2);
});
test('[STATIQUE] aucune notion de score/confiance/seuil dans confronterAttente', () => {
  const debut = induireSource.indexOf('export function confronterAttente');
  const fin = induireSource.indexOf('\n}', debut);
  const corps = sansCommentaires(induireSource.slice(debut, fin)).toLowerCase();
  for (const interdit of ['score', 'confiance', 'seuil', 'important', 'recompense', 'récompense']) {
    assert.ok(!corps.includes(interdit), `mot interdit trouvé : ${interdit}`);
  }
});

// -------------------------------------------------------------------- garde-fous : les fonctions de constat pur inchangées
test('[GARDE] comparerMotifs() reste un contenu EXACTEMENT identique à celui d\'avant ce chantier', () => {
  const attendu = `export function comparerMotifs(motifs, infoDetailleeParId) {
  return motifs.map((m) => {
    const nonResolues = [];
    const parChamp = {};
    for (const champ of CHAMPS_COMPARES) parChamp[champ] = [];
    for (const id of m.couverture) {
      const info = infoDetailleeParId.get(id);
      if (!info) { nonResolues.push(id); continue; }
      for (const champ of CHAMPS_COMPARES) {
        const valeur = info[champ] === undefined ? null : info[champ];
        parChamp[champ].push({ id, valeur });
      }
    }
    const distinction = {};
    for (const champ of CHAMPS_COMPARES) {
      const clesVues = new Set(parChamp[champ].map((v) => JSON.stringify(v.valeur)));
      distinction[champ] = { identique: clesVues.size <= 1, valeurs: parChamp[champ] };
    }
    return { gabarit: m.gabarit, cle: m.cle, couverture: m.couverture, distinction, nonResolues };
  });
}`;
  assert.ok(induireSource.includes(attendu));
});
test('[GARDE] motifsAvecVariationDEtat() reste un contenu EXACTEMENT identique à celui d\'avant ce chantier', () => {
  const attendu = `export function motifsAvecVariationDEtat(motifsRepartis) {
  return motifsRepartis.filter((m) => {
    const categoriesNonVides = CATEGORIES_ETAT.filter((c) => (m.parEtat[c] || []).length > 0);
    return categoriesNonVides.length >= 2;
  });
}`;
  assert.ok(induireSource.includes(attendu));
});

// ======================================================================= PARTIE 3 — persistance (connaissances.js)
test('[ROUGE] la table « hypotheses » existe toujours parmi les TABLES', () => {
  assert.ok(TABLES.includes('hypotheses'));
});

test('[ROUGE] enregistrerHypotheseSiNouvelle crée l\'hypothèse (schéma jugement) avec etatHypothese=proposee', async () => {
  const magasin = magasinMemoireVive();
  const pure = formerHypothesesJugement([MOTIF], new Map([['e1', 'correct'], ['e2', 'correct']]))[0];
  const objet = await enregistrerHypotheseSiNouvelle(magasin, pure);
  assert.equal(objet.etatHypothese, 'proposee');
  assert.equal(objet.attente, 'correct');
  assert.deepEqual(objet.confrontations, []);
  const toutes = await magasin.lireTout('hypotheses');
  assert.equal(toutes.length, 1);
});

test('[ROUGE] enregistrerHypotheseSiNouvelle reste IDEMPOTENTE (comportement inchangé, réutilisé tel quel)', async () => {
  const magasin = magasinMemoireVive();
  const pure = formerHypothesesJugement([MOTIF], new Map([['e1', 'correct'], ['e2', 'correct']]))[0];
  const premiere = await enregistrerHypotheseSiNouvelle(magasin, pure);
  await magasin.ecrire('hypotheses', { ...premiere, etatHypothese: 'contredite' });
  const deuxieme = await enregistrerHypotheseSiNouvelle(magasin, pure);
  assert.equal(deuxieme.etatHypothese, 'contredite');
  const toutes = await magasin.lireTout('hypotheses');
  assert.equal(toutes.length, 1);
});

test('[ROUGE] confronterEtEnregistrer compare désormais l\'attente figée de l\'hypothèse au jugement reçu', async () => {
  const magasin = magasinMemoireVive();
  const pure = formerHypothesesJugement([MOTIF], new Map([['e1', 'correct'], ['e2', 'correct']]))[0];
  await enregistrerHypotheseSiNouvelle(magasin, pure);
  const { hypothese, resultat } = await confronterEtEnregistrer(magasin, pure.id, { id: 'e4', jugement: 'correct' });
  assert.equal(resultat, 'compatible');
  assert.equal(hypothese.observations.length, 3);
  assert.equal(hypothese.confrontations.length, 1);
  assert.equal(hypothese.etatHypothese, 'proposee');
});

test('[ROUGE] une confrontation incompatible fait passer l\'hypothèse à « contredite », sans effacer ses observations passées', async () => {
  const magasin = magasinMemoireVive();
  const pure = formerHypothesesJugement([MOTIF], new Map([['e1', 'correct'], ['e2', 'correct']]))[0];
  await enregistrerHypotheseSiNouvelle(magasin, pure);
  const { resultat } = await confronterEtEnregistrer(magasin, pure.id, { id: 'e4', jugement: 'incorrect' });
  assert.equal(resultat, 'incompatible');
  const [h] = await magasin.lireTout('hypotheses');
  assert.equal(h.etatHypothese, 'contredite');
  assert.ok(h.observations.some((o) => o.id === 'e1'));
});

// ======================================================================= PARTIE 4 — JUGEMENT EXTÉRIEUR (connaissances.js)
async function experienceDeTest(magasin, texteRecu = "Comment tu t'appelles ?") {
  return enregistrerExperience(magasin, {
    texteRecu, texteRepondu: 'Naissance.', date: new Date().toISOString(), source: 'laboratoire',
  });
}

test('[ROUGE] enregistrerJugement ajoute une interprétation d\'origine « jugement-christophe », jamais ne touche « comprendre »', async () => {
  const magasin = magasinMemoireVive();
  const e = await experienceDeTest(magasin);
  await ajouterInterpretation(magasin, e.id, { origine: 'comprendre', donnees: { etat: 'compris', sujet: 'naissance', relation: 'nom' } });
  const miseAJour = await enregistrerJugement(magasin, e.id, 'correct');
  const origines = miseAJour.interpretations.map((i) => i.origine);
  assert.deepEqual(origines, ['comprendre', 'jugement-christophe']);
  const jugementInterp = miseAJour.interpretations.find((i) => i.origine === 'jugement-christophe');
  assert.equal(jugementInterp.donnees.jugement, 'correct');
});

test('[ROUGE] enregistrerJugement refuse une valeur autre que correct/incorrect', async () => {
  const magasin = magasinMemoireVive();
  const e = await experienceDeTest(magasin);
  await assert.rejects(() => enregistrerJugement(magasin, e.id, 'plutot-oui'));
});

test('[ROUGE] enregistrerJugement est APPEND-ONLY : un second jugement contradictoire ne remplace ni n\'efface le premier', async () => {
  const magasin = magasinMemoireVive();
  const e = await experienceDeTest(magasin);
  await enregistrerJugement(magasin, e.id, 'correct');
  const apres = await enregistrerJugement(magasin, e.id, 'incorrect');
  const jugements = apres.interpretations.filter((i) => i.origine === 'jugement-christophe').map((i) => i.donnees.jugement);
  assert.deepEqual(jugements, ['correct', 'incorrect']);
});

// ======================================================================= PARTIE 5 — ATTENTE AVANT JUGEMENT : LA GARANTIE D'ORDRE
test('[ROUGE] enregistrerAttenteSiPertinente ne fait rien si l\'hypothèse n\'a aucune attente univoque (attente=null)', async () => {
  const magasin = magasinMemoireVive();
  const e = await experienceDeTest(magasin);
  const hypotheseSansAttente = { id: 'hyp:mot:comment', motifCle: 'mot:comment', attente: null, provenance: [], observations: [] };
  const r = await enregistrerAttenteSiPertinente(magasin, e.id, hypotheseSansAttente);
  assert.equal(r, null);
  const apres = (await magasin.lireTout('experiences')).find((x) => x.id === e.id);
  assert.equal(apres.interpretations.length, 0);
});

test('[ROUGE] enregistrerAttenteSiPertinente pose une interprétation « attente-hypothese » AVANT tout jugement', async () => {
  const magasin = magasinMemoireVive();
  const e = await experienceDeTest(magasin);
  const hypothese = { id: 'hyp:mot:comment', motifCle: 'mot:comment', attente: 'correct', provenance: ['e1'], observations: [] };
  const miseAJour = await enregistrerAttenteSiPertinente(magasin, e.id, hypothese);
  const interp = miseAJour.interpretations.find((i) => i.origine === 'attente-hypothese');
  assert.ok(interp, 'une interprétation attente-hypothese doit être posée');
  assert.equal(interp.donnees.hypotheseId, 'hyp:mot:comment');
  assert.equal(interp.donnees.attendu, 'correct');
  // AUCUN jugement ne doit exister sur cette expérience à cet instant : la preuve d'ordre.
  assert.ok(!miseAJour.interpretations.some((i) => i.origine === 'jugement-christophe'));
});

test('[ROUGE] enregistrerAttenteSiPertinente est IDEMPOTENTE pour la même hypothèse (jamais dupliquée)', async () => {
  const magasin = magasinMemoireVive();
  const e = await experienceDeTest(magasin);
  const hypothese = { id: 'hyp:mot:comment', motifCle: 'mot:comment', attente: 'correct', provenance: [], observations: [] };
  await enregistrerAttenteSiPertinente(magasin, e.id, hypothese);
  const apres = await enregistrerAttenteSiPertinente(magasin, e.id, hypothese);
  const poses = apres.interpretations.filter((i) => i.origine === 'attente-hypothese');
  assert.equal(poses.length, 1);
});

test('[ROUGE-CRITIQUE] enregistrerAttenteSiPertinente REFUSE de poser une attente si un jugement existe déjà -- impossible de fabriquer après coup une prétendue prédiction', async () => {
  const magasin = magasinMemoireVive();
  const e = await experienceDeTest(magasin);
  await enregistrerJugement(magasin, e.id, 'correct'); // le jugement arrive D'ABORD, sans attente préalable
  const hypothese = { id: 'hyp:mot:comment', motifCle: 'mot:comment', attente: 'correct', provenance: [], observations: [] };
  await assert.rejects(
    () => enregistrerAttenteSiPertinente(magasin, e.id, hypothese),
    /jugement.*déjà|déjà.*jugement/i,
  );
  const apres = (await magasin.lireTout('experiences')).find((x) => x.id === e.id);
  assert.ok(!apres.interpretations.some((i) => i.origine === 'attente-hypothese'), 'aucune attente n\'a été fabriquée après coup');
});

// ======================================================================= PARTIE 6 — confronterJugementEtEnregistrer (orchestration complète)
test('[ROUGE] confronterJugementEtEnregistrer confronte l\'attente déjà posée au jugement reçu, et l\'enregistre', async () => {
  const magasin = magasinMemoireVive();
  const pure = formerHypothesesJugement([MOTIF], new Map([['e1', 'correct'], ['e2', 'correct']]))[0];
  await enregistrerHypotheseSiNouvelle(magasin, pure);
  const e = await experienceDeTest(magasin);
  await enregistrerAttenteSiPertinente(magasin, e.id, pure);
  const resultats = await confronterJugementEtEnregistrer(magasin, e.id, 'correct');
  assert.equal(resultats.length, 1);
  assert.equal(resultats[0].resultat, 'compatible');
  const [h] = await magasin.lireTout('hypotheses');
  assert.equal(h.etatHypothese, 'proposee');
});

test('[ROUGE] confronterJugementEtEnregistrer sans attente préalable ne confronte rien (liste vide), mais enregistre quand même le jugement', async () => {
  const magasin = magasinMemoireVive();
  const e = await experienceDeTest(magasin);
  const resultats = await confronterJugementEtEnregistrer(magasin, e.id, 'incorrect');
  assert.deepEqual(resultats, []);
  const apres = (await magasin.lireTout('experiences')).find((x) => x.id === e.id);
  assert.ok(apres.interpretations.some((i) => i.origine === 'jugement-christophe'));
});

test('[ROUGE] une attente contredite fait passer l\'hypothèse à « contredite »', async () => {
  const magasin = magasinMemoireVive();
  const pure = formerHypothesesJugement([MOTIF], new Map([['e1', 'correct'], ['e2', 'correct']]))[0];
  await enregistrerHypotheseSiNouvelle(magasin, pure);
  const e = await experienceDeTest(magasin);
  await enregistrerAttenteSiPertinente(magasin, e.id, pure);
  const resultats = await confronterJugementEtEnregistrer(magasin, e.id, 'incorrect');
  assert.equal(resultats[0].resultat, 'incompatible');
  const [h] = await magasin.lireTout('hypotheses');
  assert.equal(h.etatHypothese, 'contredite');
});
// === FIN_TEST_HYPOTHESES ===
