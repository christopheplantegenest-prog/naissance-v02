import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerMagasinMemoire } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { creerEsprit } from '../app/esprit/esprit.js';
import { REGLES } from '../app/esprit/consolidation.js';

function montage({ consolidation = () => ({ resume: null, souvenirs: [] }), reponse = (a) => `réponse ${a.historique.length}` } = {}) {
  const memoire = creerMemoire(creerMagasinMemoire());
  const appels = { envoyer: [], generer: [] };
  let t = Date.parse('2026-09-16T09:00:00Z');
  const horloge = () => new Date(t);
  const avancer = (ms) => { t += ms; };
  let moteurPresent = true;
  const moteur = {
    libelle: 'Moteur de test',
    envoyer: async (a) => { appels.envoyer.push(a); return reponse(a); },
    generer: async (a) => { appels.generer.push(a); return consolidation(a); },
  };
  const esprit = creerEsprit({ memoire, moteurActuel: () => (moteurPresent ? moteur : null), horloge });
  return { memoire, esprit, appels, avancer, sansMoteur: () => { moteurPresent = false; } };
}

test('répondre : instructions de Naissance, échange enregistré seulement après la réponse', async () => {
  const { memoire, esprit, appels } = montage();
  await assert.rejects(esprit.repondre('coucou'), { code: 'reglage' });
  await esprit.naitre('Christophe');
  const r = await esprit.repondre('Bonjour');
  assert.equal(r, 'réponse 1');
  assert.match(appels.envoyer[0].instructions, /Tu es Naissance/);
  assert.match(appels.envoyer[0].instructions, /Moteur de test/);
  assert.equal(await memoire.compterMessages(), 2);
  await esprit.repondre('Et toi ?');
  assert.deepEqual(appels.envoyer[1].historique.map((m) => m.texte), ['Bonjour', 'réponse 1', 'Et toi ?']);
});

test('un envoi raté ne laisse aucune trace', async () => {
  const { memoire, esprit } = montage({ reponse: () => { throw Object.assign(new Error('quota'), { code: 'quota' }); } });
  await esprit.naitre('C');
  await assert.rejects(esprit.repondre('perdu ?'), { code: 'quota' });
  assert.equal(await memoire.compterMessages(), 0);
});

test('la conversation survit : un nouvel esprit sur la même mémoire la reprend', async () => {
  const { memoire, esprit } = montage();
  await esprit.naitre('C');
  await esprit.repondre('Je m’appelle C');
  const suite = creerEsprit({ memoire, moteurActuel: () => ({ libelle: 'autre moteur', envoyer: async (a) => a.historique.map((m) => m.texte).join('|'), generer: async () => ({}) }) });
  assert.equal(await suite.repondre('Tu te souviens ?'), 'Je m’appelle C|réponse 1|Tu te souviens ?');
});

test('rangement : extraction après le seuil, souvenirs actifs, curseur avancé, identité intacte', async () => {
  const { memoire, esprit, appels } = montage({
    consolidation: () => ({ resume: 'ignoré', souvenirs: [{ action: 'ajouter', texte: 'C a un chat nommé Pixel', categorie: 'proches', importance: 2, source: 'dit' }] }),
  });
  await esprit.naitre('C');
  const identiteAvant = await memoire.identite();
  for (let i = 0; i < 5; i++) await esprit.repondre(`message ${i}`);
  assert.equal((await esprit.consoliderSiBesoin()).raison, 'rien');
  await esprit.repondre('message 5');
  const r = await esprit.consoliderSiBesoin();
  assert.equal(r.fait, true);
  assert.equal(r.analyses, 12);
  assert.equal(r.resume, false, 'pas de résumé demandé : le texte renvoyé est ignoré');
  const [s] = await memoire.souvenirs();
  assert.equal(s.statut, 'actif');
  assert.equal(s.confiance, 'probable');
  assert.deepEqual(s.origine, { de: 1, a: 12 });
  assert.equal((await memoire.meta()).extraitJusqua, 12);
  assert.deepEqual(await memoire.identite(), identiteAvant);
  assert.match(appels.envoyer.at(-1).instructions, /./);
  await esprit.repondre('encore');
  assert.match((await esprit.repondre('et alors')) && appels.envoyer.at(-1).instructions, /C a un chat nommé Pixel \(probable, dit par C\)/);
});

test('rangement : résumé de l’histoire ancienne, jamais des messages récents', async () => {
  const { memoire, esprit, appels } = montage({
    consolidation: (a) => ({ resume: a.entree.includes('A_RESUMER :\n(vide)') ? null : 'Résumé des débuts.', souvenirs: [] }),
  });
  await esprit.naitre('C');
  for (let i = 0; i < 19; i++) await esprit.repondre(`m${i}`);
  const r = await esprit.consoliderSiBesoin();
  assert.equal(r.resume, true);
  const fil = await memoire.fil();
  assert.equal(fil.texte, 'Résumé des débuts.');
  assert.equal(fil.jusqua, 38 - REGLES.garderRecents);
  assert.equal((await memoire.resumes()).length, 1);
  await esprit.repondre('suite');
  const dernier = appels.envoyer.at(-1);
  assert.match(dernier.instructions, /Résumé des débuts\./);
  assert.equal(dernier.historique.length, REGLES.garderRecents + 1);
});

test('échec du moteur : rien n’est perdu, nouvel essai plus tard, pas de boucle', async () => {
  let echoue = true;
  const { memoire, esprit, avancer } = montage({
    consolidation: () => { if (echoue) throw new Error('Quota gratuit atteint'); return { resume: null, souvenirs: [] }; },
  });
  await esprit.naitre('C');
  for (let i = 0; i < 6; i++) await esprit.repondre(`m${i}`);
  const r1 = await esprit.consoliderSiBesoin();
  assert.equal(r1.raison, 'echec');
  const meta = await memoire.meta();
  assert.equal(meta.extraitJusqua, 0);
  assert.match(meta.messageEchec, /Quota/);
  echoue = false;
  assert.equal((await esprit.consoliderSiBesoin()).raison, 'rien', 'attente après échec');
  avancer(REGLES.attenteApresEchecMs + 1000);
  const r2 = await esprit.consoliderSiBesoin();
  assert.equal(r2.fait, true);
  assert.equal((await memoire.meta()).echecConsolidation, null);
});

test('retour après une absence : rangement dès deux messages', async () => {
  const { esprit, avancer } = montage();
  await esprit.naitre('C');
  await esprit.repondre('un seul échange');
  assert.equal(await esprit.estRevenueApresAbsence(), false);
  avancer(REGLES.absenceMs + 1);
  assert.equal(await esprit.estRevenueApresAbsence(), true);
  assert.equal((await esprit.consoliderSiBesoin({ absence: true })).fait, true);
});

test('changer de prénom passe par l’esprit ; sans moteur, pas de rangement', async () => {
  const { memoire, esprit, sansMoteur } = montage();
  await esprit.naitre('Chris');
  await esprit.changerPrenom('Christophe');
  assert.equal((await memoire.identite()).noyau.personne, 'Christophe');
  sansMoteur();
  assert.equal((await esprit.consoliderSiBesoin({ force: true })).raison, 'pas-prete');
});
