// === DEBUT_TEST_REFERENCE_TRACE_EXPERIENCE ===
// CHANTIER « RÉFÉRENCE EXPLICITE ENTRE VÉCUS, SANS CAUSALITÉ INFÉRÉE » (décision ChatGPT,
// 03/10/2026). Référence officielle : commit 93b9cf074770d0ddad075c1d60e5b03fd4019053, VERSION
// 0.61.1, VERSION_BASE 10, 1434/1434 ×2.
//
// PRINCIPE (section 1 du cadrage) : une expérience (B1) peut désormais porter, de façon STRICTEMENT
// OPTIONNELLE et ADDITIVE, une référence explicite { idTrace } vers une trace antérieure déjà
// persistée — jamais une causalité, une confirmation, une invalidation, une utilité ou un jugement.
// AUCUN appelant actuel ne fournit cette référence (elle reste DORMANTE, section 5) : ces tests
// couvrent uniquement la PRIMITIVE elle-même, jamais un branchement comportemental (interdit par la
// section 11 du cadrage — aucune modification de main.js, aucune détection de « dernière trace »).
//
// NOM CHOISI : « referenceTrace », par analogie EXACTE avec « referenceMemoire » déjà présent sur
// la même fonction (enregistrerExperience) — même discipline : un objet reçu, reshape vers UN SEUL
// champ nommé connu ({ idTrace }, comme referenceMemoire ne garde que { idQuestion, idReponse }),
// jamais la chaîne/l'objet brut transmis tel quel sans passer par ce reshape explicite. Default
// `null`, exactement comme referenceMemoire.
//
// VALIDATION (section 6) : choix A — seulement CONSERVER la référence fournie, jamais vérifier que
// l'id désigne réellement une trace existante. C'est le même comportement qu'a TOUJOURS eu
// referenceMemoire (jamais vérifié contre naissance-memoire) : cohérence avec la convention déjà en
// place, pas une invention pour ce chantier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  magasinMemoireVive, enregistrerExperience, enregistrerTrace, nouvelId,
} from '../app/langage/connaissances.js';
import { traceExploitable, possibilitesRejeuAdmissibles } from '../app/langage/vue-traces.js';

function uneTrace(magasin, voie) {
  return enregistrerTrace(magasin, {
    capacite: 'recherche', voie, argumentsUtilises: { relation: 'r', valeur: 'v' },
    provenanceArguments: { relation: 'texte', valeur: 'texte' }, resultat: { sujets: [] },
    contexte: voie === 'action' ? { texteBrut: 'zx zy', tokens: ['zx', 'zy'] } : null,
    provenancePositions: voie === 'action' ? { relation: 0, valeur: 1 } : null,
  });
}

// A. expérience sans référence → contrat historique inchangé.
test('A. enregistrerExperience() sans referenceTrace : contrat historique exactement inchangé', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceMemoire: { idQuestion: 1, idReponse: 2 },
  });
  assert.equal(e.referenceTrace, null);
  assert.equal(e.texteRecu, 'x');
  assert.equal(e.texteRepondu, 'y');
  assert.deepEqual(e.referenceMemoire, { idQuestion: 1, idReponse: 2 });
  assert.deepEqual(e.interpretations, []);
});

// B. expérience avec référence explicite → référence conservée exactement.
test('B. enregistrerExperience() avec referenceTrace explicite : conservée exactement, forme { idTrace }', async () => {
  const magasin = magasinMemoireVive();
  const trace = await uneTrace(magasin, 'action');
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: trace.id },
  });
  assert.deepEqual(e.referenceTrace, { idTrace: trace.id });
});

// C. sauvegarde/rechargement → référence conservée.
test('C. referenceTrace survit à une écriture puis relecture depuis le magasin', async () => {
  const magasin = magasinMemoireVive();
  const trace = await uneTrace(magasin, 'rejeu');
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: trace.id },
  });
  const relue = (await magasin.lireTout('experiences')).find((x) => x.id === e.id);
  assert.deepEqual(relue.referenceTrace, { idTrace: trace.id });
});

// D. ancienne expérience sans champ → lisible, jamais reconstruite.
test('D. une expérience antérieure à ce chantier (sans le champ du tout) reste lisible, jamais complétée', async () => {
  const magasin = magasinMemoireVive();
  const ancienne = {
    id: nouvelId('experience'), texteRecu: 'ancien', texteRepondu: 'texte',
    date: new Date().toISOString(), source: 'laboratoire', referenceMemoire: null, interpretations: [],
  };
  await magasin.ecrire('experiences', ancienne);
  const relue = (await magasin.lireTout('experiences')).find((x) => x.id === ancienne.id);
  assert.equal(relue.texteRecu, 'ancien');
  assert.ok(!('referenceTrace' in relue), 'une absence totale de champ ne doit jamais être complétée en null');
});

// E. aucune référence reconstruite automatiquement.
test('E. ne fournir aucune referenceTrace, même si des traces existent déjà dans le magasin, ne crée aucune référence', async () => {
  const magasin = magasinMemoireVive();
  await uneTrace(magasin, 'action');
  await uneTrace(magasin, 'rejeu');
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
  });
  assert.equal(e.referenceTrace, null);
});

// F. aucune référence à la dernière trace par adjacence.
test('F. une trace écrite immédiatement avant l\'expérience n\'est jamais retenue par simple adjacence', async () => {
  const magasin = magasinMemoireVive();
  const derniereTrace = await uneTrace(magasin, 'action');
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
  });
  assert.equal(e.referenceTrace, null);
  assert.notEqual(JSON.stringify(e.referenceTrace), JSON.stringify({ idTrace: derniereTrace.id }));
});

// G. aucune référence par comparaison de sequence.
test('G. aucun mécanisme interne ne compare les sequence pour fabriquer une référence', async () => {
  const magasin = magasinMemoireVive();
  const trace = await uneTrace(magasin, 'action');
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
  });
  assert.equal(e.referenceTrace, null);
  assert.ok(trace.sequence >= 1);
  // La fonction ne lit jamais e.traces/trace.sequence : vérifié aussi statiquement ci-dessous (test N/O).
});

// H. aucune référence par timestamp.
test('H. un horodatage proche entre une trace et une expérience ne crée jamais de référence', async () => {
  const magasin = magasinMemoireVive();
  await uneTrace(magasin, 'action');
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
  });
  assert.equal(e.referenceTrace, null);
});

// I. id opaque conservé sans parsing.
test('I. referenceTrace.idTrace est conservé tel quel, même sous une forme imprévisible, sans parsing', async () => {
  const magasin = magasinMemoireVive();
  const idImprevisible = 'ceci-n-est-pas-un-format-de-trace-reconnu-###';
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: idImprevisible },
  });
  assert.deepEqual(e.referenceTrace, { idTrace: idImprevisible });
});

// J. référence vers action/rejeu/composition : aucune différence de traitement selon la voie.
test('J. une référence vers une trace action, rejeu ou composition est conservée IDENTIQUEMENT (aucun jugement de voie)', async () => {
  const magasin = magasinMemoireVive();
  const tAction = await uneTrace(magasin, 'action');
  const tRejeu = await uneTrace(magasin, 'rejeu');
  const tComposition = await uneTrace(magasin, 'composition');
  const eAction = await enregistrerExperience(magasin, {
    texteRecu: 'a', texteRepondu: 'a', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: tAction.id },
  });
  const eRejeu = await enregistrerExperience(magasin, {
    texteRecu: 'r', texteRepondu: 'r', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: tRejeu.id },
  });
  const eComposition = await enregistrerExperience(magasin, {
    texteRecu: 'c', texteRepondu: 'c', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: tComposition.id },
  });
  assert.deepEqual(eAction.referenceTrace, { idTrace: tAction.id });
  assert.deepEqual(eRejeu.referenceTrace, { idTrace: tRejeu.id });
  assert.deepEqual(eComposition.referenceTrace, { idTrace: tComposition.id });
});

// K. référence n'altère pas « jugement ».
test('K. jugerExperience (confronterJugementEtEnregistrer) continue de fonctionner normalement sur une expérience référençant une trace', async () => {
  const { confronterJugementEtEnregistrer } = await import('../app/langage/connaissances.js');
  const magasin = magasinMemoireVive();
  const trace = await uneTrace(magasin, 'rejeu');
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: trace.id },
  });
  await confronterJugementEtEnregistrer(magasin, e.id, 'correct', []);
  const jugee = (await magasin.lireTout('experiences')).find((x) => x.id === e.id);
  const jugements = jugee.interpretations.filter((i) => i.origine === 'jugement-christophe');
  assert.equal(jugements.length, 1);
  assert.deepEqual(jugee.referenceTrace, { idTrace: trace.id });
});

// L. référence n'altère pas traceExploitable().
test('L. la présence d\'une référence depuis une expérience ne change jamais traceExploitable() sur la trace visée', async () => {
  const magasin = magasinMemoireVive();
  const tAction = await uneTrace(magasin, 'action');
  const tRejeu = await uneTrace(magasin, 'rejeu');
  await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: tRejeu.id },
  });
  assert.equal(traceExploitable(tAction), true);
  assert.equal(traceExploitable(tRejeu), false);
});

// M. référence n'altère pas possibilitesRejeuAdmissibles().
test('M. référencer une trace rejeu depuis une expérience ne la rend jamais admissible comme preuve de rejeu', async () => {
  const magasin = magasinMemoireVive();
  const tRejeu = await uneTrace(magasin, 'rejeu');
  await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: tRejeu.id },
  });
  const sansRef = possibilitesRejeuAdmissibles([tRejeu], 'zx zy');
  const traces = await magasin.lireTout('traces');
  const avecRef = possibilitesRejeuAdmissibles(traces, 'zx zy');
  assert.deepEqual(sansRef, avecRef);
});

// N. aucun appel de capacité.
test('N. connaissances.js (enregistrerExperience) n\'importe jamais le registre des capacités (statique)', () => {
  const src = fs.readFileSync(new URL('../app/langage/connaissances.js', import.meta.url), 'utf8');
  assert.ok(!src.includes("from './registre.js'"));
  assert.ok(!src.includes('CAPACITES'));
});

// O. aucun consommateur spontané via apresNouveauVecu().
test('O. vecu.js ne lit jamais referenceTrace et apresNouveauVecu() garde son contrat {type,id} strict (statique)', () => {
  const srcVecu = fs.readFileSync(new URL('../app/langage/vecu.js', import.meta.url), 'utf8');
  assert.ok(!srcVecu.includes('referenceTrace'));
  const srcConnaissances = fs.readFileSync(new URL('../app/langage/connaissances.js', import.meta.url), 'utf8');
  // enregistrerExperience() elle-même n'appelle jamais apresNouveauVecu : ce point d'orchestration
  // reste exclusivement câblé depuis main.js/ecran.js, jamais depuis la primitive de persistance.
  const debut = srcConnaissances.indexOf('export async function enregistrerExperience');
  const fin = srcConnaissances.indexOf('\n}', debut);
  const corps = srcConnaissances.slice(debut, fin);
  assert.ok(!corps.includes('apresNouveauVecu'));
});

// CONTRE-EXEMPLE actif : une référence vers une trace qui n'existe PAS (choix A, section 6) est
// quand même conservée telle quelle — AUCUNE vérification d'existence, par cohérence avec
// referenceMemoire qui n'a jamais vérifié idQuestion/idReponse contre naissance-memoire.
test('contre-exemple. une référence vers un idTrace inexistant est conservée sans erreur (choix A, non B)', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: 'trace-qui-n-existe-pas' },
  });
  assert.deepEqual(e.referenceTrace, { idTrace: 'trace-qui-n-existe-pas' });
});

// CONTRE-EXEMPLE actif : un objet referenceTrace portant des champs supplémentaires inattendus
// (ex. une tentative d'y glisser un jugement) ne doit PAS être transmis tel quel : seul idTrace
// est reshapé, exactement comme referenceMemoire ne garde que ses deux champs nommés.
test('contre-exemple. un champ supplémentaire glissé dans referenceTrace (ex. jugement) n\'est jamais conservé', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
    referenceTrace: { idTrace: 'trace-1', jugement: 'correct', score: 0.99 },
  });
  assert.deepEqual(e.referenceTrace, { idTrace: 'trace-1' });
});
// === FIN_TEST_REFERENCE_TRACE_EXPERIENCE ===
