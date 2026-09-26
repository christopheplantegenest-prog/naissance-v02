// === DEBUT_TEST_FORMATION_AUTOMATIQUE ===
// CHANTIER « FIN DES FONDATIONS » (décision ChatGPT du 26/09/2026) — DEUX capacités manquantes
// après la v0.19.0 (validée téléphone) :
//   A — la FORMATION d'une hypothèse ne doit plus dépendre du clic laboratoire manuel « Former des
//       hypothèses » : dès qu'un jugement extérieur arrive sur une expérience, Naissance réexamine
//       elle-même tout son vécu disponible et forme les hypothèses que ce vécu justifie déjà
//       (examinerVecuEtFormerHypotheses(), connaissances.js — déclenchée par
//       confronterJugementEtEnregistrer()).
//   B — une CONTRADICTION (hypothèse passée à « contredite ») doit devenir une nouvelle information
//       pour l'apprentissage : le réexamen automatique doit pouvoir laisser émerger une hypothèse
//       PLUS PRÉCISE sur un motif différent, SI et SEULEMENT SI le vécu déjà observé le justifie
//       réellement — jamais une combinaison de motifs inventée à la main, jamais un seuil, jamais un
//       cas particulier linguistique.
//
// Point important : AUCUN nouvel algorithme de comparaison n'a été nécessaire pour B. repererMotifs()
// constate déjà, indépendamment, CHAQUE motif structurel qui revient (un mot, un rôle) sans jamais
// les combiner ni les hiérarchiser (voir induction.js). formerHypothesesJugement() forme une
// hypothèse PAR motif, séparément. Réexaminer tout le vécu à chaque jugement suffit donc, de lui-même,
// à faire apparaître un motif plus étroit dès qu'il devient suffisamment observé (couverture >=
// seuilMin) — sans qu'aucune notion de « combinaison » ou de « discrimination » ait été codée ici.
// Voir le scénario bout-en-bout ci-dessous (PARTIE 3), qui le prouve sur des données réelles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  magasinMemoireVive, enregistrerExperience, enregistrerAttenteSiPertinente,
  confronterJugementEtEnregistrer, examinerVecuEtFormerHypotheses,
} from '../app/langage/connaissances.js';

async function experience(magasin, texteRecu, date) {
  return enregistrerExperience(magasin, { texteRecu, texteRepondu: 'Je ne sais pas.', date, source: 'laboratoire' });
}

// ======================================================================= PARTIE 1 — examinerVecuEtFormerHypotheses(), seule
test('[ROUGE] aucune expérience jugée : le réexamen ne forme rien', async () => {
  const magasin = magasinMemoireVive();
  await experience(magasin, 'Quel est ton nom ?', '2026-09-26T10:00:00.000Z');
  await experience(magasin, 'Quel est ton age ?', '2026-09-26T10:01:00.000Z');
  const nouvelles = await examinerVecuEtFormerHypotheses(magasin);
  assert.deepEqual(nouvelles, []);
  assert.deepEqual(await magasin.lireTout('hypotheses'), []);
});

test('[ROUGE] deux expériences jugées pareil, partageant un motif : une hypothèse univoque apparaît, SANS clic laboratoire', async () => {
  const magasin = magasinMemoireVive();
  const e1 = await experience(magasin, 'Quel est ton nom ?', '2026-09-26T10:00:00.000Z');
  const e2 = await experience(magasin, 'Quel est ton age ?', '2026-09-26T10:01:00.000Z');
  await confronterJugementEtEnregistrer(magasin, e1.id, 'correct');
  const nouvelles = await confronterJugementEtEnregistrer(magasin, e2.id, 'correct')
    .then(() => examinerVecuEtFormerHypotheses(magasin)); // idempotent : rien de nouveau à ce second appel
  const toutes = await magasin.lireTout('hypotheses');
  const h = toutes.find((x) => x.motifCle === 'mot:quel');
  assert.ok(h, 'une hypothèse sur « mot:quel » doit exister — formée automatiquement par le jugement, jamais par un clic');
  assert.equal(h.attente, 'correct');
  assert.deepEqual(nouvelles, [], 'le second appel ne recrée rien : idempotent');
});

test('[ROUGE] une hypothèse déjà formée n\'est jamais recréée ni son attente figée recalculée (idempotence)', async () => {
  const magasin = magasinMemoireVive();
  const e1 = await experience(magasin, 'Quel est ton nom ?', '2026-09-26T10:00:00.000Z');
  const e2 = await experience(magasin, 'Quel est ton age ?', '2026-09-26T10:01:00.000Z');
  await confronterJugementEtEnregistrer(magasin, e1.id, 'correct');
  await confronterJugementEtEnregistrer(magasin, e2.id, 'correct');
  const [avant] = (await magasin.lireTout('hypotheses')).filter((h) => h.motifCle === 'mot:quel');
  // Un troisième jugement DIVERGENT sur le même motif ne doit JAMAIS réécrire l'attente déjà figée --
  // seule la confrontation (hors de portée ici, voir hypotheses.test.mjs) fait évoluer une hypothèse
  // existante, jamais un second passage par examinerVecuEtFormerHypotheses.
  const e3 = await experience(magasin, 'Quel est ton prenom ?', '2026-09-26T10:02:00.000Z');
  await confronterJugementEtEnregistrer(magasin, e3.id, 'incorrect');
  const [apres] = (await magasin.lireTout('hypotheses')).filter((h) => h.motifCle === 'mot:quel');
  assert.equal(apres.attente, 'correct', 'attente figée à la formation, jamais recalculée par un réexamen ultérieur');
  assert.deepEqual(apres.provenance, avant.provenance, 'provenance figée elle aussi, jamais réécrite');
});

// ======================================================================= PARTIE 2 — déclenchement automatique (connaissances.js seul, jamais pont.js)
test('[STATIQUE] confronterJugementEtEnregistrer déclenche le réexamen (une hypothèse apparaît après jugement, sans appel explicite à examinerVecuEtFormerHypotheses ni à aucun clic)', async () => {
  const magasin = magasinMemoireVive();
  const e1 = await experience(magasin, 'Quel est ton nom ?', '2026-09-26T10:00:00.000Z');
  const e2 = await experience(magasin, 'Quel est ton age ?', '2026-09-26T10:01:00.000Z');
  assert.deepEqual(await magasin.lireTout('hypotheses'), []);
  await confronterJugementEtEnregistrer(magasin, e1.id, 'correct');
  await confronterJugementEtEnregistrer(magasin, e2.id, 'correct');
  const toutes = await magasin.lireTout('hypotheses');
  assert.ok(toutes.some((h) => h.motifCle === 'mot:quel'), 'la seule action prise ici est de JUGER -- jamais de former explicitement');
});

// ======================================================================= PARTIE 3 — SCÉNARIO BOUT-EN-BOUT (demande explicite de ChatGPT, 9 points)
// Prouve, sur des données réelles (jamais simulées), la boucle complète :
//   1. aucune hypothèse pertinente au départ
//   2. plusieurs expériences + jugements arrivent
//   3. une hypothèse apparaît SANS clic laboratoire
//   4. une nouvelle expérience déclenche une attente AVANT son jugement
//   5. le jugement contredit cette attente
//   6. la contradiction reste enregistrée (jamais effacée, jamais réécrite)
//   7. le système réexamine automatiquement son vécu
//   8. une hypothèse DIFFÉRENTE et plus précise apparaît, SI le vécu le justifie réellement
//   9. une expérience ultérieure met cette nouvelle hypothèse à l'épreuve
test('[ROUGE-CRITIQUE] scénario complet : formation automatique, attente contredite, réexamen automatique, hypothèse plus précise, mise à l\'épreuve', async () => {
  const magasin = magasinMemoireVive();

  // ---- 1. Aucune hypothèse pertinente au départ.
  assert.deepEqual(await magasin.lireTout('hypotheses'), []);

  // ---- 2. Deux expériences partageant le motif large « mot:quel », jugées CORRECT toutes les deux.
  const e1 = await experience(magasin, 'Quel est ton nom ?', '2026-09-26T10:00:00.000Z');
  const e2 = await experience(magasin, 'Quel est ton age ?', '2026-09-26T10:01:00.000Z');
  await confronterJugementEtEnregistrer(magasin, e1.id, 'correct');
  await confronterJugementEtEnregistrer(magasin, e2.id, 'correct');

  // ---- 3. Une hypothèse apparaît SANS aucun clic laboratoire (jamais formerHypothesesJugement()
  // ni enregistrerHypotheseSiNouvelle() appelées directement ici -- uniquement des jugements).
  const hypQuelInitiale = (await magasin.lireTout('hypotheses')).find((h) => h.motifCle === 'mot:quel');
  assert.ok(hypQuelInitiale, 'hyp:mot:quel doit exister, formée automatiquement');
  assert.equal(hypQuelInitiale.attente, 'correct');
  assert.equal(hypQuelInitiale.etatHypothese, 'proposee');

  // ---- 4. Nouvelle expérience, du même motif « mot:quel », PAS ENCORE jugée : on pose l'attente
  // AVANT tout jugement (le refus mécanique de l'ordre inverse est déjà prouvé ailleurs, voir
  // tests/hypotheses.test.mjs -- ici on prouve seulement que l'attente EST bien posée avant coup).
  const e3 = await experience(magasin, 'Quel est ta couleur preferee ?', '2026-09-26T10:02:00.000Z');
  await enregistrerAttenteSiPertinente(magasin, e3.id, hypQuelInitiale);
  const e3AvantJugement = (await magasin.lireTout('experiences')).find((x) => x.id === e3.id);
  assert.ok(e3AvantJugement.interpretations.some((i) => i.origine === 'attente-hypothese' && i.donnees.attendu === 'correct'));
  assert.ok(!e3AvantJugement.interpretations.some((i) => i.origine === 'jugement-christophe'), 'aucun jugement encore -- l\'attente n\'a pas été fabriquée après coup');

  // ---- 5. Le jugement réel CONTREDIT l'attente posée (Christophe juge « incorrect »).
  const resultatsE3 = await confronterJugementEtEnregistrer(magasin, e3.id, 'incorrect');
  assert.equal(resultatsE3.length, 1);
  assert.equal(resultatsE3[0].resultat, 'incompatible');

  // ---- 6. La contradiction reste enregistrée : rien n'est effacé, rien n'est réécrit rétroactivement.
  const hypQuelApresContradiction = (await magasin.lireTout('hypotheses')).find((h) => h.motifCle === 'mot:quel');
  assert.equal(hypQuelApresContradiction.etatHypothese, 'contredite');
  assert.equal(hypQuelApresContradiction.attente, 'correct', 'l\'attente figée à la formation n\'est JAMAIS réécrite, même contredite');
  assert.equal(hypQuelApresContradiction.confrontations.length, 1);
  assert.equal(hypQuelApresContradiction.confrontations[0].resultat, 'incompatible');
  assert.deepEqual(hypQuelApresContradiction.provenance.sort(), hypQuelInitiale.provenance.sort(), 'provenance d\'origine intacte');

  // ---- 7. Le système a DÉJÀ réexaminé son vécu automatiquement (à l'intérieur de l'appel précédent,
  // aucun second appel explicite ici) -- mais aucune distinction plus fine n'est ENCORE possible :
  // seule e3 porte le motif « mot:couleur », et un motif isolé (couverture 1) n'est jamais retenu.
  assert.ok(!(await magasin.lireTout('hypotheses')).some((h) => h.motifCle === 'mot:couleur'));

  // Une seconde expérience du motif « mot:couleur », jugée pareil (INCORRECT elle aussi), rend enfin
  // ce motif plus étroit suffisamment observé (couverture 2) pour justifier sa propre hypothèse.
  const e4 = await experience(magasin, 'Quel est ta couleur du jour ?', '2026-09-26T10:03:00.000Z');
  await confronterJugementEtEnregistrer(magasin, e4.id, 'incorrect');

  // ---- 8. Une hypothèse DIFFÉRENTE et plus précise apparaît -- « mot:couleur », attente=incorrect --
  // sans qu'aucune règle de combinaison de motifs n'ait été codée : repererMotifs() la constatait déjà
  // (motif indépendant, comme tous les autres), seule sa couverture est devenue suffisante.
  const hypCouleur = (await magasin.lireTout('hypotheses')).find((h) => h.motifCle === 'mot:couleur');
  assert.ok(hypCouleur, 'hyp:mot:couleur doit apparaître automatiquement : le vécu (e3, e4, toutes deux incorrect) le justifie déjà');
  assert.equal(hypCouleur.attente, 'incorrect');
  assert.deepEqual(hypCouleur.provenance.sort(), [e3.id, e4.id].sort());
  // La large hypothèse contredite, elle, reste contredite -- rien n'est « guéri » par la découverte
  // de la plus précise.
  const hypQuelFinale = (await magasin.lireTout('hypotheses')).find((h) => h.motifCle === 'mot:quel');
  assert.equal(hypQuelFinale.etatHypothese, 'contredite');

  // ---- 9. Une expérience ULTÉRIEURE met la nouvelle hypothèse plus précise à l'épreuve : attente
  // posée AVANT jugement (même garantie d'ordre qu'au point 4), puis confrontée.
  const e5 = await experience(magasin, 'Ta couleur est belle ?', '2026-09-26T10:04:00.000Z');
  await enregistrerAttenteSiPertinente(magasin, e5.id, hypCouleur);
  const e5AvantJugement = (await magasin.lireTout('experiences')).find((x) => x.id === e5.id);
  assert.ok(e5AvantJugement.interpretations.some((i) => i.origine === 'attente-hypothese' && i.donnees.attendu === 'incorrect'));
  const resultatsE5 = await confronterJugementEtEnregistrer(magasin, e5.id, 'incorrect');
  assert.equal(resultatsE5.length, 1);
  assert.equal(resultatsE5[0].resultat, 'compatible', 'la nouvelle hypothèse, plus précise, tient -- là où la large avait été contredite');
  const hypCouleurFinale = (await magasin.lireTout('hypotheses')).find((h) => h.motifCle === 'mot:couleur');
  assert.equal(hypCouleurFinale.etatHypothese, 'proposee', 'jamais contredite : elle survit à l\'épreuve qui avait fait échouer la large');
});
// === FIN_TEST_FORMATION_AUTOMATIQUE ===
