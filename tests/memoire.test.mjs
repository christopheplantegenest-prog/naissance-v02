import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerMagasinMemoire } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { creerIdentite } from '../app/esprit/identite.js';

const nouvelle = () => creerMemoire(creerMagasinMemoire());

test('naissance unique, avec identifiant et date', async () => {
  const m = nouvelle();
  assert.equal(await m.estNee(), false);
  const id = await m.naitre(creerIdentite({ personne: 'C', date: 'd' }), '2026-09-16T09:00:00Z');
  assert.ok(id.length >= 8);
  assert.equal(await m.estNee(), true);
  assert.equal((await m.meta()).neeLe, '2026-09-16T09:00:00Z');
  await assert.rejects(m.naitre(creerIdentite({ personne: 'D', date: 'd' }), 'x'));
});

test('journal : identifiants croissants, derniers messages, plages', async () => {
  const m = nouvelle();
  for (let i = 0; i < 5; i++) {
    await m.ajouterEchange({ question: `q${i}`, reponse: `r${i}`, moteur: 'm', dateQuestion: 'a', dateReponse: 'b' });
  }
  assert.equal(await m.compterMessages(), 10);
  assert.equal(await m.compterMessages(6), 4);
  assert.deepEqual((await m.derniersMessages(3)).map((x) => x.id), [8, 9, 10]);
  assert.deepEqual((await m.messagesApres(2, 3)).map((x) => x.id), [3, 4, 5]);
  assert.deepEqual((await m.messagesApres(2, 10, 5)).map((x) => x.id), [3, 4]);
  assert.deepEqual((await m.messagesApres(4, 10, 5)), []);
  const [q] = await m.derniersMessages(2);
  assert.equal(q.role, 'moi');
});

test('fil et méta par défaut, mises à jour partielles', async () => {
  const m = nouvelle();
  assert.deepEqual(await m.fil(), { texte: '', jusqua: 0, modifie: null });
  await m.majMeta({ extraitJusqua: 4 });
  await m.majMeta({ dernierExport: 'e' });
  const meta = await m.meta();
  assert.equal(meta.extraitJusqua, 4);
  assert.equal(meta.dernierExport, 'e');
});

test('export sans la copie de secours ; import remplace tout et repart des bons numéros', async () => {
  const m = nouvelle();
  await m.naitre(creerIdentite({ personne: 'C', date: 'd' }), 'n');
  await m.ajouterEchange({ question: 'q', reponse: 'r', moteur: 'm', dateQuestion: 'a', dateReponse: 'b' });
  await m.ecrireSouvenirs([{ id: 's1', texte: 'souvenir', statut: 'actif' }]);
  const donnees = await m.exporterDonnees();

  const autre = nouvelle();
  for (let i = 0; i < 4; i++) await autre.ajouterEchange({ question: 'x', reponse: 'y', moteur: 'm', dateQuestion: 'a', dateReponse: 'b' });
  await autre.remplacerDonnees(donnees, { sauvegarde: { format: 'naissance', marque: 1 } });
  assert.equal(await autre.compterMessages(), 2);
  assert.equal((await autre.souvenirs()).length, 1);
  assert.equal((await autre.sauvegardeAvantImport()).marque, 1);
  const [idQ] = await autre.ajouterEchange({ question: 'suite', reponse: 'ok', moteur: 'm', dateQuestion: 'a', dateReponse: 'b' });
  assert.equal(idQ, 3);
  const reexport = await autre.exporterDonnees();
  assert.ok(!reexport.cles.some((c) => c.cle === 'sauvegardeAvantImport'));
});

test('le magasin rend des copies : modifier un objet lu ne change pas la mémoire', async () => {
  const m = nouvelle();
  await m.ecrireSouvenirs([{ id: 's1', texte: 'original', statut: 'actif' }]);
  const [s] = await m.souvenirs();
  s.texte = 'modifié en douce';
  assert.equal((await m.lireSouvenir('s1')).texte, 'original');
});

test('journal des actions : écrit, lié à un message, exporté ; import ancien sans actions', async () => {
  const m = nouvelle();
  await m.ajouterAction({ id: 'a-1', date: '2026-09-16T10:00:00Z', messageId: null, nom: 'retenir', statut: 'executee' });
  await m.ajouterAction({ id: 'a-2', date: '2026-09-16T11:00:00Z', messageId: null, nom: 'retenir', statut: 'invalide' });
  await m.lierActions(['a-1', 'inconnue'], 7);
  assert.equal((await m.actions()).find((a) => a.id === 'a-1').messageId, 7);
  assert.deepEqual((await m.actionsRecentes(1)).map((a) => a.id), ['a-2']);
  const d = await m.exporterDonnees();
  assert.equal(d.actions.length, 2);
  const { actions, ...ancien } = d;
  await m.remplacerDonnees(ancien);
  assert.deepEqual(await m.actions(), []);
});
