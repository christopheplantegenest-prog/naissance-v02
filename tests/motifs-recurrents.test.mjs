// === DEBUT_TEST_MOTIFS_RECURRENTS ===
// TESTS ROUGES SEULEMENT — aucune implémentation n'existe encore (B3a).
//
// Objectif : Naissance doit pouvoir CONSTATER qu'un motif structurel revient dans plusieurs
// expériences B1, sans jamais décider qu'il est intéressant, sans lui donner de signification,
// sans écrire quoi que ce soit. Séparation stricte : COMPARER + CONSTATER (B3a) — jamais DÉCIDER
// ni COMPRENDRE (hors de portée ici).
//
// Choix d'API testé ici (à discuter après coup, pas imposé comme définitif) : une nouvelle
// fonction exportée par induction.js — même famille que induire() (pure, isolée, aucune connexion
// à connaissances.js/esprit.js/magasin) :
//
//   repererMotifs(experiences, { lexique, seuilMin = 2, nMax = 4 })
//     experiences : [{ id, texteRecu }, ...]  — PAS l'objet B1 complet, pas de magasin ici.
//     retour      : [{ gabarit, cle, couverture: [id, ...] }, ...]
//
// Ne préjuge pas qu'il faille exporter ngrammesDe/candidatsEvalues : ces tests portent sur le
// comportement observable, jamais sur l'implémentation interne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { repererMotifs } from '../app/langage/induction.js';
import { chargerEsprit, repondre } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const induireSource = readFileSync(join(RACINE_APP, 'langage', 'induction.js'), 'utf8');
const connaissancesSource = readFileSync(join(RACINE_APP, 'langage', 'connaissances.js'), 'utf8');
const pontSource = readFileSync(join(RACINE_APP, 'langage', 'pont.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// Vécu de référence (famille « coucou », comme le diagnostic) : ids EXPLICITES, jamais reconstruits.
const EXPERIENCES = [
  { id: 'e1', texteRecu: 'Coucou, ma couleur est rouge ?' },
  { id: 'e2', texteRecu: 'Bonjour, ma ville est Paris ?' },
  { id: 'e3', texteRecu: 'Coucou, mon nom est Paul ?' },
  { id: 'e4', texteRecu: 'Quelle est ma couleur ?' },
  { id: 'e5', texteRecu: 'Coucou, ma ville est Lyon ?' },
];

function trouve(rapport, predicat) {
  return rapport.filter(predicat);
}
function couvre(motif, ids) {
  return [...motif.couverture].sort().join(',') === [...ids].sort().join(',');
}

// -------------------------------------------------------------------- 1 — deux expériences, un motif partagé
test('[ROUGE] deux expériences partageant un motif le font apparaître, avec leurs deux ids en couverture', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const motifCouleur = trouve(rapport, (m) => m.cle === 'mot:couleur');
  assert.equal(motifCouleur.length, 1);
  assert.ok(couvre(motifCouleur[0], ['e1', 'e4']));
});

// -------------------------------------------------------------------- 2 — trois expériences, un motif partagé
test('[ROUGE] trois expériences partageant un motif donnent une couverture de trois ids', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const motifCoucou = trouve(rapport, (m) => m.cle === 'mot:coucou');
  assert.equal(motifCoucou.length, 1);
  assert.ok(couvre(motifCoucou[0], ['e1', 'e3', 'e5']));
});

// -------------------------------------------------------------------- 3 — absence si le motif n'y est pas
test('[ROUGE] une expérience ne contenant pas le motif n\'apparaît jamais dans sa couverture', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const motifCoucou = trouve(rapport, (m) => m.cle === 'mot:coucou')[0];
  assert.ok(!motifCoucou.couverture.includes('e2')); // « Bonjour », jamais « Coucou »
  assert.ok(!motifCoucou.couverture.includes('e4'));
});

// -------------------------------------------------------------------- 4 — plusieurs motifs coexistent
test('[ROUGE] plusieurs motifs distincts coexistent dans le même rapport', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const cles = new Set(rapport.map((m) => m.cle));
  assert.ok(cles.has('mot:coucou'));
  assert.ok(cles.has('mot:ville'));
  assert.ok(cles.has('mot:couleur'));
});

// -------------------------------------------------------------------- 5, 6 — triviaux acceptés, sans jugement
test('[ROUGE] un motif trivial très fréquent (« est ») PEUT apparaître : aucune heuristique d\'importance', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const motifEst = trouve(rapport, (m) => m.cle === 'mot:est');
  assert.equal(motifEst.length, 1);
  assert.equal(motifEst[0].couverture.length, 5);
});
test('[ROUGE] un rôle générique très fréquent (possessif_moi) PEUT apparaître, même principe', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const motifRole = trouve(rapport, (m) => m.cle === 'role:possessif_moi');
  assert.equal(motifRole.length, 1);
  assert.equal(motifRole[0].couverture.length, 5);
});

// -------------------------------------------------------------------- 7 — aucune signification
test('[ROUGE] aucune entrée du rapport ne porte de signification', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  assert.ok(rapport.length > 0);
  for (const m of rapport) assert.ok(!('signification' in m));
});

// -------------------------------------------------------------------- 8 — pas de notion positif/négatif
test('[ROUGE] la fonction ne prend aucun tableau de négatifs : un seul paramètre obligatoire', () => {
  assert.equal(repererMotifs.length, 1);
  // Fonctionne sans jamais fournir de négatifs, sur un simple tableau d'expériences.
  assert.doesNotThrow(() => repererMotifs(EXPERIENCES));
});

// -------------------------------------------------------------------- 9, 10 — jamais d'apprentissage/induction interne
test('[STATIQUE] repererMotifs n\'appelle jamais apprendreGabaritType ni induire() en son sein', () => {
  const debut = induireSource.indexOf('function repererMotifs') >= 0
    ? induireSource.indexOf('repererMotifs')
    : induireSource.indexOf('repererMotifs');
  assert.ok(debut >= 0, 'repererMotifs doit être défini dans induction.js');
  const bloc = sansCommentaires(induireSource.slice(debut));
  assert.ok(!bloc.includes('apprendreGabaritType'));
  // « induire(» tout court apparaîtrait aussi dans son PROPRE nom si on cherchait juste "induire" —
  // on cherche l'appel réel, jamais la définition de la fonction induire elle-même.
  const appelsInduire = bloc.match(/(?<![a-zA-Zé])induire\(/g) || [];
  assert.equal(appelsInduire.length, 0, 'repererMotifs ne doit jamais appeler induire()');
});

// -------------------------------------------------------------------- 11, 12 — aucune écriture
test('[ROUGE] repererMotifs n\'écrit rien : appelée deux fois de suite, elle rend le même résultat', () => {
  const experiences = EXPERIENCES.map((e) => Object.freeze({ ...e }));
  Object.freeze(experiences);
  const r1 = repererMotifs(experiences, { seuilMin: 2 });
  const r2 = repererMotifs(experiences, { seuilMin: 2 });
  assert.deepEqual(r1, r2);
});
test('[STATIQUE] induction.js n\'importe toujours aucune table de connaissances (garde-fou existant, étendu à repererMotifs)', () => {
  assert.ok(!induireSource.includes("from './connaissances.js'"));
  assert.ok(!induireSource.includes("from './esprit.js'"));
});

// -------------------------------------------------------------------- 13 — aucun changement de comprendre()
test('[ROUGE] appeler repererMotifs ne change en rien le comportement de comprendre()/repondre()', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  const avant = repondre(esprit, 'Salut, mon prénom est Paul.');
  repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const apres = repondre(esprit, 'Salut, mon prénom est Paul.');
  assert.deepEqual(avant, apres);
});

// -------------------------------------------------------------------- 14 — aucun déclenchement automatique
// Note (chantier B3a UI, v0.17.11) : ecranSource a été retiré de cette liste. Ce test date d'avant
// tout câblage : à l'époque, aucun fichier n'avait le droit d'appeler repererMotifs, point. Depuis,
// le chantier « BRANCHEMENT LECTURE SEULE SUR LE VÉCU B1 » l'a câblée délibérément dans ecran.js,
// mais UNIQUEMENT derrière le clic manuel de Christophe sur « Repérer les motifs »
// (data-langage-motifs-lister) — jamais automatiquement. La garantie réelle que ce test protège —
// aucun déclenchement CACHÉ, sans action de Christophe — reste vraie pour connaissances.js et
// pont.js (le chemin de conversation réelle) : ce sont eux qui ne doivent JAMAIS l'appeler, câblage
// ou non, car un appel depuis l'un d'eux serait par définition un déclenchement automatique.
test('[STATIQUE] aucun fichier de câblage AUTOMATIQUE (connaissances.js, pont.js) n\'appelle repererMotifs (aucun déclenchement caché)', () => {
  for (const src of [connaissancesSource, pontSource]) {
    assert.ok(!src.includes('repererMotifs'));
  }
});

// -------------------------------------------------------------------- 15 — recalculable, jamais figé
test('[ROUGE] le rapport se recalcule depuis texteRecu + lexique courant, jamais depuis une interprétation figée', () => {
  const lexiqueSansGadget = {};
  const lexiqueAvecGadget = { gadget: { role: 'relation', relation: 'gadget' } };
  const experiences = [
    { id: 'a', texteRecu: 'Mon gadget est bleu ?' },
    { id: 'b', texteRecu: 'Mon gadget est rouge ?' },
  ];
  const sansRole = repererMotifs(experiences, { lexique: lexiqueSansGadget, seuilMin: 2 });
  const avecRole = repererMotifs(experiences, { lexique: lexiqueAvecGadget, seuilMin: 2 });
  assert.ok(!sansRole.some((m) => m.cle === 'role:relation'));
  assert.ok(avecRole.some((m) => m.cle === 'role:relation'));
});

// -------------------------------------------------------------------- 16 — pas de fusion arbitraire
test('[ROUGE] deux motifs différents couvrant exactement les mêmes expériences restent deux entrées distinctes', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const motifEst = trouve(rapport, (m) => m.cle === 'mot:est')[0];
  const motifRole = trouve(rapport, (m) => m.cle === 'role:verbe_conjugue')[0];
  assert.ok(motifEst && motifRole);
  assert.ok(couvre(motifEst, motifRole.couverture)); // même couverture...
  assert.notEqual(motifEst.cle, motifRole.cle); // ...mais deux entrées séparées, jamais fusionnées
});

// -------------------------------------------------------------------- 17 — indépendance à l'ordre
test('[ROUGE] l\'ordre des expériences fournies ne change pas la réalité des couvertures obtenues', () => {
  const melangees = [EXPERIENCES[3], EXPERIENCES[1], EXPERIENCES[4], EXPERIENCES[0], EXPERIENCES[2]];
  const r1 = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const r2 = repererMotifs(melangees, { seuilMin: 2 });
  const normalise = (r) => new Map(r.map((m) => [m.cle, [...m.couverture].sort().join(',')]));
  assert.deepEqual(normalise(r1), normalise(r2));
});

// -------------------------------------------------------------------- 18 — une seule expérience n'est pas une récurrence
test('[ROUGE] un motif présent dans une seule expérience n\'est PAS qualifié de récurrent par défaut', () => {
  const rapport = repererMotifs(EXPERIENCES, { seuilMin: 2 });
  const motifNom = trouve(rapport, (m) => m.cle === 'mot:nom' || m.cle === 'mot:paul');
  assert.equal(motifNom.length, 0);
  // Avec seuilMin=1, ce même motif redeviendrait visible — seuilMin=2 est bien le vrai minimum
  // conceptuel de « ça revient », jamais 1.
  const rapportSeuil1 = repererMotifs(EXPERIENCES, { seuilMin: 1 });
  assert.ok(trouve(rapportSeuil1, (m) => m.couverture.length === 1).length > 0);
});
test('[ROUGE] SANS PRÉCISER seuilMin (valeur par défaut), un motif unique reste absent : le défaut est bien 2, jamais 1', () => {
  const rapportParDefaut = repererMotifs(EXPERIENCES);
  const motifNom = trouve(rapportParDefaut, (m) => m.cle === 'mot:nom' || m.cle === 'mot:paul');
  assert.equal(motifNom.length, 0);
  assert.ok(rapportParDefaut.some((m) => m.cle === 'mot:coucou')); // un vrai récurrent reste visible
});
// === FIN_TEST_MOTIFS_RECURRENTS ===
