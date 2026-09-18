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
    envoyer: async ({ preparer }) => {
      const a = await preparer('Moteur de test');
      appels.envoyer.push(a);
      return { texte: reponse(a), libelle: 'Moteur de test', note: '' };
    },
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
  assert.deepEqual(r, { texte: 'réponse 1', note: '', actions: [], local: false, idQuestion: 1 });
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
  const suite = creerEsprit({ memoire, moteurActuel: () => ({
    libelle: 'autre moteur',
    envoyer: async ({ preparer }) => ({ texte: (await preparer('autre moteur')).historique.map((m) => m.texte).join('|'), libelle: 'autre moteur' }),
    generer: async () => ({}),
  }) });
  assert.equal((await suite.repondre('Tu te souviens ?')).texte, 'Je m’appelle C|réponse 1|Tu te souviens ?');
});

test('rangement : extraction après le seuil, souvenirs actifs, curseur avancé, identité intacte', async () => {
  const { memoire, esprit, appels } = montage({
    consolidation: () => ({ resume: 'ignoré', souvenirs: [{ action: 'ajouter', texte: 'C a un chat nommé Pixel', categorie: 'proches', importance: 2, source: 'dit' }] }),
  });
  await esprit.naitre('C');
  const identiteAvant = await memoire.identite();
  for (let i = 0; i < 11; i++) await esprit.repondre(`message ${i}`);
  assert.equal((await esprit.consoliderSiBesoin()).raison, 'rien', '22 messages : pas encore de rangement automatique');
  await esprit.repondre('message 11');
  const r = await esprit.consoliderSiBesoin();
  assert.equal(r.fait, true);
  assert.equal(r.analyses, 24);
  assert.equal(r.resume, false, '24 messages : trop peu au-delà des 16 récents pour résumer (texte renvoyé ignoré)');
  const [s] = await memoire.souvenirs();
  assert.equal(s.statut, 'actif');
  assert.equal(s.confiance, 'probable');
  assert.deepEqual(s.origine, { de: 1, a: 24 });
  assert.equal((await memoire.meta()).extraitJusqua, 24);
  assert.ok((await memoire.meta()).derniereConsolidationAuto);
  assert.deepEqual((await memoire.identite()).noyau, identiteAvant.noyau);
  assert.equal(appels.generer.length, 1);
  for (let i = 0; i < 12; i++) await esprit.repondre(`suite ${i}`);
  assert.equal((await esprit.consoliderSiBesoin()).raison, 'rien', 'moins de 3 h après : pas de nouveau rangement automatique');
  assert.equal((await esprit.consoliderSiBesoin({ force: true })).fait, true, '« Ranger maintenant » reste possible');
  await esprit.repondre('et alors');
  assert.match(appels.envoyer.at(-1).instructions, /C a un chat nommé Pixel \(confirmé, dit par C\)/, 'revu une 2e fois : confirmé, sans doublon');
  assert.equal((await memoire.souvenirs()).length, 1);
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
  for (let i = 0; i < 12; i++) await esprit.repondre(`m${i}`);
  const r1 = await esprit.consoliderSiBesoin();
  assert.equal(r1.raison, 'echec');
  const meta = await memoire.meta();
  assert.equal(meta.extraitJusqua, 0);
  assert.match(meta.messageEchec, /Quota/);
  echoue = false;
  assert.equal((await esprit.consoliderSiBesoin()).raison, 'rien', 'attente après échec');
  avancer(REGLES.intervalleAutoMs + 1000);
  const r2 = await esprit.consoliderSiBesoin();
  assert.equal(r2.fait, true);
  assert.equal((await memoire.meta()).echecConsolidation, null);
});

test('retour après une absence : rangement dès dix messages non analysés', async () => {
  const { esprit, avancer } = montage();
  await esprit.naitre('C');
  for (let i = 0; i < 4; i++) await esprit.repondre(`échange ${i}`);
  avancer(REGLES.absenceMs + 1);
  assert.equal(await esprit.estRevenueApresAbsence(), true);
  assert.equal((await esprit.consoliderSiBesoin({ absence: true })).raison, 'rien', '8 messages : pas de rangement');
  await esprit.repondre('encore un');
  avancer(REGLES.absenceMs + 1);
  assert.equal((await esprit.consoliderSiBesoin({ absence: true })).fait, true);
});

test('économie : pas de rangement automatique quand le quota du jour est déjà entamé', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  let appelsDuJour = REGLES.reserveConversation;
  const esprit = creerEsprit({
    memoire,
    appelsAujourdhui: () => appelsDuJour,
    moteurActuel: () => ({
      libelle: 'M',
      envoyer: async ({ preparer }) => { await preparer('M'); return { texte: 'ok', libelle: 'M' }; },
      generer: async () => ({ resume: null, souvenirs: [] }),
    }),
  });
  await esprit.naitre('C');
  for (let i = 0; i < 30; i++) await esprit.repondre(`m${i}`);
  assert.equal((await esprit.consoliderSiBesoin()).raison, 'rien');
  appelsDuJour = 3;
  assert.equal((await esprit.consoliderSiBesoin()).fait, true);
});

test('progression : l’esprit signale l’action en cours et transmet l’annulation', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const etapes = [];
  const controleur = new AbortController();
  let signalRecu = null;
  const esprit = creerEsprit({
    memoire,
    moteurActuel: () => ({
      libelle: 'M',
      envoyer: async ({ preparer, executer, surEtape, signal }) => {
        signalRecu = signal;
        surEtape({ type: 'essai', modele: 'm', rang: 0, tentative: 0 });
        await preparer('M');
        await executer({ nom: 'retenir', parametres: { information: 'C aime le jazz.' } });
        return { texte: 'ok', libelle: 'M' };
      },
      generer: async () => ({}),
    }),
  });
  await esprit.naitre('C');
  await esprit.repondre('Retiens que j’aime le jazz', { surEtape: (e) => etapes.push(e), signal: controleur.signal });
  assert.equal(signalRecu, controleur.signal);
  assert.deepEqual(etapes.map((e) => e.type), ['essai', 'action']);
  assert.equal(etapes[1].texte, 'Naissance enregistre un souvenir…');
});

test('changer de prénom passe par l’esprit ; sans moteur, pas de rangement', async () => {
  const { memoire, esprit, sansMoteur } = montage();
  await esprit.naitre('Chris');
  await esprit.changerPrenom('Christophe');
  assert.equal((await memoire.identite()).noyau.personne, 'Christophe');
  sansMoteur();
  assert.equal((await esprit.consoliderSiBesoin({ force: true })).raison, 'pas-prete');
});

test('repli : le journal garde le moteur réellement utilisé, et le contexte le nomme', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const vus = [];
  const esprit = creerEsprit({
    memoire,
    moteurActuel: () => ({
      libelle: 'Moteur A',
      envoyer: async ({ preparer }) => {
        vus.push((await preparer('Moteur A')).instructions);
        vus.push((await preparer('Moteur B')).instructions);
        return { texte: 'ok', libelle: 'Moteur B', note: 'Réponse donnée par B' };
      },
      generer: async () => ({}),
    }),
  });
  await esprit.naitre('C');
  const r = await esprit.repondre('salut');
  assert.equal(r.note, 'Réponse donnée par B');
  assert.match(vus[1], /réponds honnêtement : Moteur B/);
  const journal = await memoire.derniersMessages(2);
  assert.deepEqual(journal.map((m) => m.moteur), ['Moteur B', 'Moteur B']);
});

test('mise à jour : une identité ancienne reçoit les principes validés avant de répondre', async () => {
  const { memoire, esprit, appels } = montage();
  await esprit.naitre('C');
  const i = await memoire.identite();
  await memoire.poserIdentite({ ...i, amendements: [], noyau: { ...i.noyau, principes: i.noyau.principes.filter((p) => !p.startsWith('Ne dis que tu as retenu')) } });
  await esprit.repondre('Retiens que j’aime le thé');
  assert.match(appels.envoyer[0].instructions, /Ne dis que tu as retenu une information que si ton action retenir a réellement réussi/);
  const apres = await memoire.identite();
  assert.equal(apres.changements.at(-1).par, 'personne');
  const nb = apres.changements.length;
  await esprit.repondre('encore');
  assert.equal((await memoire.identite()).changements.length, nb, 'appliqué une seule fois');
});

import { REGLES_FIABILITE } from '../app/fournisseurs/fiabilite.js';

function moteurQuiAgit(scenario) {
  // scenario(essai, preparer, executer) → { texte, libelle }
  let essai = 0;
  return {
    libelle: 'Moteur A',
    envoyer: async ({ preparer, actions, executer }) => scenario(++essai, preparer, executer, actions),
    generer: async () => ({ resume: null, souvenirs: [] }),
  };
}

test('actions : « retiens » → souvenir réel, action liée au message, notes renvoyées', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const vus = {};
  const esprit = creerEsprit({
    memoire,
    moteurActuel: () => moteurQuiAgit(async (essai, preparer, executer, actions) => {
      vus.instructions = (await preparer('Moteur A')).instructions;
      vus.actions = actions;
      const r = await executer({ nom: 'retenir', parametres: { information: 'C aime la raclette.', categorie: 'preference' } });
      return { texte: r.ok ? 'C’est retenu.' : 'Je n’ai pas pu.', libelle: 'Moteur A' };
    }),
  });
  await esprit.naitre('C');
  const r = await esprit.repondre('Retiens que mon plat préféré est la raclette');
  assert.equal(r.texte, 'C’est retenu.');
  assert.deepEqual(r.actions, ['Souvenir ajouté : C aime la raclette.']);
  assert.deepEqual(vus.actions.map((a) => a.nom), ['retenir']);
  assert.match(vus.instructions, /tu peux maintenant demander au programme les actions suivantes/);
  const [s] = await memoire.souvenirs();
  assert.equal(s.source, 'demande');
  const [action] = await memoire.actions();
  assert.equal(action.messageId, 1, 'l’action est liée à la question dans le journal');
  assert.equal(action.moteur, 'Moteur A');
});

test('actions : conversation banale → aucune action, aucun souvenir', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const esprit = creerEsprit({
    memoire,
    moteurActuel: () => moteurQuiAgit(async (e, preparer) => { await preparer('Moteur A'); return { texte: 'Salut !', libelle: 'Moteur A' }; }),
  });
  await esprit.naitre('C');
  const r = await esprit.repondre('Il fait beau aujourd’hui');
  assert.deepEqual(r.actions, []);
  assert.equal((await memoire.souvenirs()).length, 0);
  assert.equal((await memoire.actions()).length, 0);
});

test('actions : changement de moteur en cours de route → rien n’est rejoué, le nouveau moteur est prévenu', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const instructionsB = [];
  const esprit = creerEsprit({
    memoire,
    moteurActuel: () => moteurQuiAgit(async (essai, preparer, executer) => {
      // Simule la couche de fiabilité : A agit puis tombe en panne, B reprend.
      await preparer('Moteur A');
      await executer({ nom: 'retenir', parametres: { information: 'C aime la raclette.' } });
      const b = await preparer('Moteur B');
      instructionsB.push(b.instructions);
      const r = await executer({ nom: 'retenir', parametres: { information: 'C aime la raclette.' } });
      return { texte: r.dejaFaite ? 'Déjà retenu.' : 'Rejoué !', libelle: 'Moteur B' };
    }),
  });
  await esprit.naitre('C');
  const r = await esprit.repondre('Retiens la raclette');
  assert.equal(r.texte, 'Déjà retenu.');
  assert.equal((await memoire.souvenirs()).length, 1);
  assert.match(instructionsB[0], /ont DÉJÀ été exécutées[\s\S]*retenir : « C aime la raclette\. » → Souvenir enregistré/);
  assert.match(instructionsB[0], /- C aime la raclette\. \(confirmé, retenu à la demande de C\)/, 'le nouveau moteur voit le souvenir tout juste créé');
  const statuts = (await memoire.actions()).map((a) => a.statut).sort();
  assert.deepEqual(statuts, ['deja-faite', 'executee']);
});

test('actions : la réponse échoue après une action → l’erreur signale ce qui a été fait', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const esprit = creerEsprit({
    memoire,
    moteurActuel: () => moteurQuiAgit(async (e, preparer, executer) => {
      await preparer('Moteur A');
      await executer({ nom: 'retenir', parametres: { information: 'C aime la raclette.' } });
      throw Object.assign(new Error('Aucun modèle n’a pu répondre'), { code: 'indisponible' });
    }),
  });
  await esprit.naitre('C');
  await assert.rejects(esprit.repondre('Retiens la raclette'), (e) => {
    assert.equal(e.code, 'indisponible');
    assert.deepEqual(e.actions, ['Souvenir ajouté : C aime la raclette.']);
    return true;
  });
  assert.equal(await memoire.compterMessages(), 0, 'la conversation ratée n’est pas enregistrée');
  assert.equal((await memoire.souvenirs()).length, 1, 'mais le souvenir, réellement créé, est bien là');
  assert.ok(REGLES_FIABILITE.maxModeles >= 1);
});

test('moteur local : contexte compact demandé, reprise sans la réponse locale, rangement jamais local', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const vus = [];
  let modeLocal = true;
  const esprit = creerEsprit({
    memoire,
    moteurActuel: () => ({
      libelle: 'Aiguilleur',
      envoyer: async ({ preparer, forcerExterne, message }) => {
        if (modeLocal && !forcerExterne) {
          const c = await preparer('Moteur local — LFM2-350M Q4_0', 'local');
          vus.push({ profil: 'local', c, message });
          return { texte: 'réponse locale', libelle: 'Moteur local — LFM2-350M Q4_0', local: true };
        }
        const c = await preparer('Externe', 'externe');
        vus.push({ profil: 'externe', c, message });
        return { texte: 'réponse forte', libelle: 'Externe', local: false };
      },
      generer: null,
    }),
  });
  await esprit.naitre('C');
  await esprit.repondre('Bonjour');
  const r = await esprit.repondre('Tu fais quoi ?');
  assert.equal(r.local, true);
  assert.equal(vus[1].profil, 'local');
  assert.match(vus[1].c.prefixe, /^Tu es Naissance, l'IA personnelle de C\./);
  assert.deepEqual(vus[1].c.elements.map((m) => m.texte), ['Bonjour', 'réponse locale', "Tu n'as aucun souvenir utile pour cette question : dis-le à C plutôt que d'inventer.", 'Tu fais quoi ?']);
  const reprise = await esprit.repondre('Tu fais quoi ?', { forcerExterne: true, repriseDe: r.idQuestion });
  assert.equal(reprise.local, false);
  assert.deepEqual(vus[2].c.historique.map((m) => m.texte), ['Bonjour', 'réponse locale', 'Tu fais quoi ?'], 'la réponse locale refaite n’est pas montrée, le début du fil est gardé');
  const journal = await memoire.derniersMessages(6);
  assert.deepEqual(journal.map((m) => m.moteur), [
    'Moteur local — LFM2-350M Q4_0', 'Moteur local — LFM2-350M Q4_0',
    'Moteur local — LFM2-350M Q4_0', 'Moteur local — LFM2-350M Q4_0', 'Externe', 'Externe',
  ]);
  assert.equal(journal[4].reprise, r.idQuestion);
  assert.equal(journal[4].texte, 'Tu fais quoi ?');
  for (let i = 0; i < 20; i++) await esprit.repondre(`m${i}`);
  assert.equal((await esprit.consoliderSiBesoin({ force: true })).raison, 'pas-prete', 'sans moteur externe, pas de rangement');
  modeLocal = false;
});
