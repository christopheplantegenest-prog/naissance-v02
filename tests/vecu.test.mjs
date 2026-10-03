// === DEBUT_TEST_VECU ===
// Point d'orchestration commun minimal (décision ChatGPT « POINT D'ORCHESTRATION COMMUN DU VÉCU »,
// 03/10/2026). Fonctions PURES, testées isolément — aucun magasin, aucune UI, aucune capacité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apresNouveauVecu, composerApresVecu, TYPES_VECU } from '../app/langage/vecu.js';

test('apresNouveauVecu : type "experience" accepté, renvoie exactement { type, id }', async () => {
  const r = await apresNouveauVecu({ type: 'experience', id: 'experience-123' });
  assert.deepEqual(r, { type: 'experience', id: 'experience-123' });
});

test('apresNouveauVecu : type "trace" accepté, renvoie exactement { type, id }', async () => {
  const r = await apresNouveauVecu({ type: 'trace', id: 'trace-456' });
  assert.deepEqual(r, { type: 'trace', id: 'trace-456' });
});

test('apresNouveauVecu : ne renvoie RIEN d\'autre que type/id (aucun champ supplémentaire)', async () => {
  const r = await apresNouveauVecu({ type: 'trace', id: 'trace-456' });
  assert.deepEqual(Object.keys(r).sort(), ['id', 'type']);
});

test('apresNouveauVecu : un type inconnu est rejeté explicitement (Error), jamais absorbé', async () => {
  await assert.rejects(() => apresNouveauVecu({ type: 'inconnu', id: 'x' }), /inconnu.*n'est pas un type de vécu connu/);
});

test('apresNouveauVecu : un type inconnu ne modifie ni ne lit aucun état (fonction pure, appel répétable)', async () => {
  await assert.rejects(() => apresNouveauVecu({ type: 'autre-chose', id: 'x' }));
  await assert.rejects(() => apresNouveauVecu({ type: 'autre-chose', id: 'x' }));
});

test('TYPES_VECU : exactement {experience, trace}, rien de plus', () => {
  assert.deepEqual([...TYPES_VECU].sort(), ['experience', 'trace']);
});

test('composerApresVecu : appelle apresNouveauVecu PUIS le traitement existant, dans cet ordre, une seule fois', async () => {
  const appels = [];
  const traitementExistant = async (id) => { appels.push(['traitement', id]); return { posees: ['hyp:x'], proposition: null }; };
  const enveloppe = composerApresVecu('experience', traitementExistant);
  const resultat = await enveloppe('experience-789');
  // Le traitement existant a bien été appelé, une seule fois, avec le même id.
  assert.deepEqual(appels, [['traitement', 'experience-789']]);
  // Le résultat renvoyé est EXACTEMENT celui du traitement existant (rien d'autre ajouté/retiré).
  assert.deepEqual(resultat, { posees: ['hyp:x'], proposition: null });
});

test('composerApresVecu : propage telle quelle une erreur levée par le traitement existant', async () => {
  const traitementQuiEchoue = async () => { throw new Error('échec du traitement existant'); };
  const enveloppe = composerApresVecu('experience', traitementQuiEchoue);
  await assert.rejects(() => enveloppe('experience-1'), /échec du traitement existant/);
});

test('composerApresVecu : un type invalide empêche TOUJOURS d\'atteindre le traitement existant', async () => {
  let appele = false;
  const traitement = async () => { appele = true; };
  const enveloppe = composerApresVecu('ni-experience-ni-trace', traitement);
  await assert.rejects(() => enveloppe('x'));
  assert.equal(appele, false);
});
// === FIN_TEST_VECU ===
