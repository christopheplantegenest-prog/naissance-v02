// === DEBUT_TEST_PONT_ATTENTES ===
// TESTS ROUGES D'ABORD — étape E (décision ChatGPT du 26/09/2026, « SIGNAL D'APPRENTISSAGE ») :
// brancher le repérage d'attentes DANS la conversation normale, sans jamais recalculer les motifs
// récurrents ici (repererMotifs() reste strictement derrière le clic manuel de Christophe dans le
// laboratoire -- voir tests/motifs-recurrents.test.mjs, qui interdit tout appel à repererMotifs
// depuis pont.js/connaissances.js). pont.js reste ignorant de CE que fait apresNouvelleExperience :
// une simple dépendance FACULTATIVE, injectée par main.js (qui la relie à
// ecranLangage.reconnaitreAttentesPourExperience()), appelée après CHAQUE nouvelle expérience B1
// réelle -- jamais avant qu'elle existe, jamais pour un tour qui ne crée aucune expérience.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tenterPontLangage, enregistrerExperienceTentativeEchouee } from '../app/langage/pont.js';
import { chargerEsprit, apprendreRelation, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

async function faux(apresNouvelleExperience) {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const deps = {
    assurerEsprit: async () => e,
    journaliser: async () => [41, 99],
    enregistrerExperience: async (donnees) => enregistrerExperience(magasin, donnees),
    ajouterInterpretation: async (id, donnees) => ajouterInterpretation(magasin, id, donnees),
    ...(apresNouvelleExperience ? { apresNouvelleExperience } : {}),
  };
  return { magasin, deps, e };
}

test('[ROUGE] un tour COMPRIS appelle apresNouvelleExperience(id) avec l\'id de l\'expérience réellement créée', async () => {
  const appels = [];
  const { deps, e } = await faux(async (id) => appels.push(id));
  await apprendreRelation(e, { mot: 'manteau', relation: 'manteau' });
  await apprendreFait(e, { sujet: 'moi', relation: 'manteau', valeur: 'un manteau bleu' });
  const r = await tenterPontLangage('Quel est mon manteau ?', deps);
  assert.equal(appels.length, 1);
  assert.equal(typeof appels[0], 'string');
});

test('[ROUGE] apresNouvelleExperience est FACULTATIVE : son absence ne casse rien (comportement inchangé)', async () => {
  const { deps, e } = await faux(); // pas de apresNouvelleExperience
  await apprendreRelation(e, { mot: 'manteau', relation: 'manteau' });
  await apprendreFait(e, { sujet: 'moi', relation: 'manteau', valeur: 'un manteau bleu' });
  const r = await tenterPontLangage('Quel est mon manteau ?', deps);
  assert.equal(r.local, true);
});

test('[ROUGE] un tour sans "?" (aucune expérience créée) n\'appelle jamais apresNouvelleExperience', async () => {
  const appels = [];
  const { deps } = await faux(async (id) => appels.push(id));
  const r = await tenterPontLangage('Bonjour.', deps);
  assert.equal(r, null);
  assert.equal(appels.length, 0);
});

test('[ROUGE] enregistrerExperienceTentativeEchouee (PARTIEL/INCOMPRIS) appelle aussi apresNouvelleExperience(id)', async () => {
  const appels = [];
  const { magasin, deps } = await faux(async (id) => appels.push(id));
  const reponse = { texte: 'Je ne connais pas encore ce mot.', idQuestion: 41, idReponse: 99, dateQuestion: '2026-09-26T08:00:00.000Z' };
  const tentative = { etat: 'partiel', comprehension: { etat: 'partiel', sujet: 'moi', relation: null, mots: ['zorglub'], motsInconnus: ['zorglub'] } };
  await enregistrerExperienceTentativeEchouee('Zorglub ?', tentative, reponse, deps);
  assert.equal(appels.length, 1);
  const [exp] = await magasin.lireTout('experiences');
  assert.equal(appels[0], exp.id);
});

// Le garde-fou « pont.js n'appelle jamais le repérage de motifs » vit déjà dans
// tests/motifs-recurrents.test.mjs (élargi à ce fichier, jamais dupliqué ici).
// === FIN_TEST_PONT_ATTENTES ===
