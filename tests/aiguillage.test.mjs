import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluerDemande, decider, envoyerAiguille } from '../app/esprit/aiguillage.js';
import { ErreurFournisseur } from '../app/fournisseurs/erreurs.js';

test('évaluation prudente : échanges simples en local, le reste en externe', () => {
  const ok = (m) => assert.equal(evaluerDemande(m).adaptee, true, m);
  const non = (m, raison) => assert.equal(evaluerDemande(m).raison, raison, m);
  ok('Bonjour Naissance, ça va ?');
  ok('Merci, bonne nuit !');
  ok('Tu te souviens de ma couleur préférée ?');
  ok('Je suis content de ma journée');
  non('Écris-moi une fonction Python pour trier une liste', 'programmation');
  non('Il y a un bug dans mon code', 'programmation');
  non('Retiens que je joue de la guitare', 'action à faire');
  non("Quelle est la météo aujourd'hui ?", 'actualité');
  non('Qui est le président du Sénat ?', 'actualité');
  non("C'est quoi un trou noir ?", 'connaissances précises');
  non('Explique-moi la photosynthèse', 'connaissances précises');
  non('Raconte-moi une histoire', 'texte long ou analyse');
  non('Résume ce que je t’ai dit', 'texte long ou analyse');
  non('Combien font 128 fois 3 ?', 'connaissances précises');
  non('Ça va ? Tu fais quoi ?', 'plusieurs questions');
  non('a'.repeat(300), 'message long');
});

test('décision selon le mode et la disponibilité des moteurs', () => {
  const d = (mode, message, l = true, e = true, forcer = false) => decider({ mode, message, localDisponible: l, externeDisponible: e, forcerExterne: forcer }).moteur;
  assert.equal(d('externe-seul', 'salut'), 'externe');
  assert.equal(d('externe-seul', 'salut', true, false), 'aucun');
  assert.equal(d('local-seul', 'Écris du code'), 'local');
  assert.equal(d('local-seul', 'salut', false, true), 'aucun');
  assert.equal(d('externe-dabord', 'salut'), 'externe');
  assert.equal(d('externe-dabord', 'salut', true, false), 'local');
  assert.equal(d('local-dabord', 'salut'), 'local');
  assert.equal(d('local-dabord', 'Écris du code'), 'externe');
  assert.equal(d('local-dabord', 'Écris du code', true, false), 'local', 'sans moteur externe, le local tente quand même');
  assert.equal(d('local-dabord', 'salut', false, true), 'externe');
  assert.equal(d('local-seul', 'salut', true, true, true), 'externe', '« Demander à un modèle plus fort » passe outre le mode');
  assert.equal(d('local-dabord', 'salut', true, false, true), 'aucun');
  assert.match(decider({ mode: 'local-dabord', message: 'Écris du code', localDisponible: true, externeDisponible: true }).note, /moteur externe \(programmation\)/);
});

function moteur(nom, comportement) {
  const appels = [];
  return {
    appels,
    libelle: nom,
    envoyer: async (a) => {
      appels.push(a);
      const r = comportement(a);
      if (r instanceof Error) throw r;
      return { texte: `réponse ${nom}`, libelle: nom, note: r && r.note ? r.note : '' };
    },
  };
}
const base = { preparer: async () => ({}), actions: [], executer: async () => ({}) };

test('local d’abord : réponse locale, marquée comme telle', async () => {
  const local = moteur('local', () => ({}));
  const externe = moteur('externe', () => ({}));
  const r = await envoyerAiguille({ ...base, mode: 'local-dabord', local, externe, message: 'Salut !' });
  assert.equal(r.local, true);
  assert.equal(r.texte, 'réponse local');
  assert.equal(externe.appels.length, 0);
  assert.ok(!('actions' in local.appels[0]), 'le moteur local ne reçoit aucune action');
});

test('local en échec → moteur externe, avec une note ; annulation → aucun repli', async () => {
  const local = moteur('local', () => new ErreurFournisseur('local', 'Mémoire insuffisante pour le moteur local.'));
  const externe = moteur('externe', () => ({ note: 'note externe' }));
  const etapes = [];
  const r = await envoyerAiguille({ ...base, mode: 'local-dabord', local, externe, message: 'Salut', surEtape: (e) => etapes.push(e.type) });
  assert.equal(r.local, false);
  assert.match(r.note, /Le moteur local n'a pas pu répondre \(Mémoire insuffisante.*\) : réponse d'un moteur externe\. note externe/);
  assert.ok(etapes.includes('repli-local'));
  const annule = moteur('local', () => Object.assign(new Error('Envoi annulé.'), { code: 'annule' }));
  await assert.rejects(envoyerAiguille({ ...base, mode: 'local-dabord', local: annule, externe, message: 'Salut' }), { code: 'annule' });
  assert.equal(externe.appels.length, 1);
  await assert.rejects(envoyerAiguille({ ...base, mode: 'local-seul', local, externe, message: 'Salut' }), { code: 'local' });
});

test('externe d’abord : repli local seulement si les moteurs externes sont indisponibles', async () => {
  const local = moteur('local', () => ({}));
  const panne = moteur('externe', () => new ErreurFournisseur('indisponible', 'Aucun modèle n’a pu répondre.'));
  const r = await envoyerAiguille({ ...base, mode: 'externe-dabord', local, externe: panne, message: 'Salut' });
  assert.equal(r.local, true);
  assert.match(r.note, /Moteurs externes indisponibles/);
  const cle = moteur('externe', () => new ErreurFournisseur('cle', 'clé refusée'));
  await assert.rejects(envoyerAiguille({ ...base, mode: 'externe-dabord', local, externe: cle, message: 'Salut' }), { code: 'cle' });
  await assert.rejects(envoyerAiguille({ ...base, mode: 'local-dabord', local, externe: panne, message: 'Écris du code' }), { code: 'indisponible' }, 'local d’abord : une demande jugée inadaptée ne repart pas vers le local');
});

test('« Demander à un modèle plus fort » : toujours le moteur externe', async () => {
  const local = moteur('local', () => ({}));
  const externe = moteur('externe', () => ({}));
  const r = await envoyerAiguille({ ...base, mode: 'local-seul', local, externe, message: 'Salut', forcerExterne: true });
  assert.equal(r.local, false);
  assert.equal(local.appels.length, 0);
  await assert.rejects(envoyerAiguille({ ...base, mode: 'local-seul', local, externe: null, message: 'Salut', forcerExterne: true }), { code: 'reglage' });
});
