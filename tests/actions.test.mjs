import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerCatalogue, catalogueParDefaut } from '../app/actions/catalogue.js';
import { controlerSchema } from '../app/actions/schema.js';
import { retenir, dejaConnu } from '../app/actions/retenir.js';
import { creerSessionActions, LIMITES_ACTIONS } from '../app/actions/executeur.js';
import { creerMagasinMemoire } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';

const horloge = () => new Date('2026-09-16T15:00:00Z');

test('v0.6 : une seule action disponible, décrite sans aucune fonction', () => {
  const decl = catalogueParDefaut.declarations('Christophe');
  assert.deepEqual(decl.map((a) => a.nom), ['retenir']);
  assert.match(decl[0].description, /Christophe te demande explicitement/);
  assert.match(decl[0].parametres.properties.information.description, /Christophe aime la raclette/);
  assert.deepEqual(decl[0].parametres.required, ['information']);
  assert.ok(!JSON.stringify(decl).includes('function'));
  assert.equal(catalogueParDefaut.trouver('retenir').niveau, 'libre');
  assert.equal(catalogueParDefaut.trouver('supprimerTout'), null);
  assert.equal(catalogueParDefaut.trouver({}), null);
});

test('catalogue : définitions incohérentes refusées', () => {
  const base = { nom: 'essai', niveau: 'libre', description: 'd', parametres: {}, valider: () => ({}), executer: () => ({}), resumer: () => '', noter: () => '' };
  assert.throws(() => creerCatalogue([{ ...base, niveau: 'total' }]), /Niveau/);
  assert.throws(() => creerCatalogue([{ ...base, nom: 'Mauvais nom!' }]), /mal définie/);
  assert.throws(() => creerCatalogue([base, base]), /double/);
  assert.throws(() => creerCatalogue([{ ...base, executer: null }]), /executer/);
  assert.deepEqual(creerCatalogue([{ ...base, niveau: 'bloquee' }]).declarations('x'), [], 'une action bloquée n’est pas proposée');
});

test('schéma : champs inconnus, obligatoires, types et valeurs permises', () => {
  const s = { properties: { a: { type: 'string' }, n: { type: 'integer' }, e: { type: 'string', enum: ['x', 'y'] } }, required: ['a'] };
  assert.equal(controlerSchema(s, { a: 't' }).ok, true);
  assert.match(controlerSchema(s, {}).raison, /obligatoire/);
  assert.match(controlerSchema(s, { a: 't', pirate: 1 }).raison, /inconnu/);
  assert.match(controlerSchema(s, { a: 3 }).raison, /texte/);
  assert.match(controlerSchema(s, { a: 't', n: 1.5 }).raison, /entier/);
  assert.match(controlerSchema(s, { a: 't', e: 'z' }).raison, /x, y/);
  assert.match(controlerSchema(s, 'texte').raison, /mal formés/);
  assert.match(controlerSchema(s, [1]).raison, /mal formés/);
});

test('retenir : paramètres nettoyés, valeurs par défaut, refus clairs', () => {
  const v = retenir.valider({ information: '  Christophe   aime la raclette.  ', categorie: 'Préférence', importance: 7 });
  assert.deepEqual(v, { ok: true, parametres: { information: 'Christophe aime la raclette.', categorie: 'preference', importance: 3, confiance: 'certain' } });
  assert.equal(retenir.valider({ information: 'x' }).ok, false);
  assert.equal(retenir.valider({}).ok, false);
  assert.match(retenir.valider({ information: 'a'.repeat(400) }).raison, /dépasse/);
  assert.match(retenir.valider({ information: 'valide', confiance: 'absolue' }).raison, /confiance/);
  assert.match(retenir.valider({ information: 'valide', ecrireDansLaBase: true }).raison, /inconnu/);
  assert.equal(retenir.valider({ information: 'valide', categorie: 'n’importe quoi' }).parametres.categorie, 'autre');
  assert.equal(retenir.valider(null).ok, false);
});

test('doublons reconnus : même phrase, phrase incluse, mêmes mots-clés', () => {
  const souvenirs = [
    { id: 's1', texte: 'Christophe aime la raclette.', statut: 'actif' },
    { id: 's2', texte: 'Christophe habite à Marcillac-Lanville.', statut: 'actif' },
    { id: 's3', texte: 'Christophe joue du piano.', statut: 'archive' },
  ];
  assert.equal(dejaConnu('christophe aime la RACLETTE', souvenirs).id, 's1');
  assert.equal(dejaConnu('Christophe habite à Marcillac-Lanville depuis longtemps', souvenirs).id, 's2');
  assert.equal(dejaConnu('Raclette : Christophe aime', souvenirs).id, 's1');
  assert.equal(dejaConnu('Christophe aime la fondue.', souvenirs), null);
  assert.equal(dejaConnu('Christophe joue du piano.', souvenirs), null, 'un souvenir archivé ne bloque pas');
  const enfants = [{ id: 'e', texte: 'Christophe a 3 enfants.', statut: 'actif' }];
  assert.equal(dejaConnu('Christophe a 4 enfants.', enfants), null, 'des nombres différents ne sont pas un doublon');
  assert.equal(dejaConnu('Christophe a 3 enfants', enfants).id, 'e');
});

function session(options = {}) {
  const memoire = creerMemoire(creerMagasinMemoire());
  const journal = [];
  const s = creerSessionActions({
    catalogue: options.catalogue || catalogueParDefaut,
    contexte: { memoire, horloge },
    journaliser: async (e) => { journal.push(e); await memoire.ajouterAction(e); },
    confirmer: options.confirmer,
    moteurCourant: () => 'moteur X',
    limites: options.limites,
  });
  return { memoire, journal, s };
}

test('exécuteur : retenir crée un vrai souvenir, journalisé, avec note', async () => {
  const { memoire, journal, s } = session();
  const r = await s.executer({ nom: 'retenir', parametres: { information: 'Christophe aime la raclette.', categorie: 'preference' } });
  assert.deepEqual(r, {
    ok: true, etat: 'ajoute', souvenir: 'Christophe aime la raclette.', message: 'Souvenir enregistré.',
    consigne: 'Réponds directement à la personne, en le tutoyant et avec tes propres mots ; ne recopie pas cette formulation interne.',
  });
  const [souvenir] = await memoire.souvenirs();
  assert.equal(souvenir.source, 'demande');
  assert.equal(souvenir.confiance, 'certain');
  assert.equal(souvenir.statut, 'actif');
  assert.equal(souvenir.origine.action, journal[0].id);
  assert.equal(journal[0].statut, 'executee');
  assert.equal(journal[0].moteur, 'moteur X');
  assert.deepEqual(s.notes, ['Souvenir ajouté : Christophe aime la raclette.']);
  assert.equal((await memoire.actions()).length, 1);
});

test('exécuteur : jamais rejouée dans le même message, même à la demande d’un autre moteur', async () => {
  const { memoire, journal, s } = session();
  const p = { information: 'Christophe aime la raclette.' };
  await s.executer({ nom: 'retenir', parametres: p });
  const encore = await s.executer({ nom: 'retenir', parametres: { ...p } });
  assert.equal(encore.dejaFaite, true);
  assert.equal((await memoire.souvenirs()).length, 1);
  assert.deepEqual(journal.map((j) => j.statut), ['executee', 'deja-faite']);
  assert.match(s.dejaFaites()[0], /retenir : « Christophe aime la raclette\. » → Souvenir enregistré/);
});

test('exécuteur : même information dans un message suivant → confirmée, pas de doublon', async () => {
  const { memoire, s } = session();
  await s.executer({ nom: 'retenir', parametres: { information: 'Christophe aime la raclette.', confiance: 'probable' } });
  const suite = creerSessionActions({ catalogue: catalogueParDefaut, contexte: { memoire, horloge }, journaliser: (e) => memoire.ajouterAction(e) });
  const r = await suite.executer({ nom: 'retenir', parametres: { information: 'christophe aime la raclette', importance: 3 } });
  assert.equal(r.etat, 'deja-connu');
  const liste = await memoire.souvenirs();
  assert.equal(liste.length, 1);
  assert.equal(liste[0].confiance, 'certain');
  assert.equal(liste[0].importance, 3);
  assert.match(suite.notes[0], /Déjà dans ses souvenirs/);
});

test('exécuteur : action inconnue, paramètres invalides → refus journalisé, rien d’écrit', async () => {
  const { memoire, journal, s } = session();
  const inconnue = await s.executer({ nom: 'effacerLaMemoire', parametres: {} });
  assert.equal(inconnue.ok, false);
  const invalide = await s.executer({ nom: 'retenir', parametres: { texte: 'mauvais champ' } });
  assert.equal(invalide.ok, false);
  assert.deepEqual(journal.map((j) => j.statut), ['invalide', 'invalide']);
  assert.equal((await memoire.souvenirs()).length, 0);
  assert.equal(s.notes.length, 2);
  assert.ok(s.notes.every((n) => n.startsWith('Action refusée')));
});

test('exécuteur : limite d’actions et de demandes par message', async () => {
  const { memoire, s } = session();
  const sujets = ['Christophe cultive des tomates au jardin', 'Christophe écoute du jazz le soir', 'Christophe prépare un voyage en Bretagne'];
  for (let i = 0; i < LIMITES_ACTIONS.maxActionsParMessage; i++) {
    assert.equal((await s.executer({ nom: 'retenir', parametres: { information: sujets[i] } })).etat, 'ajoute');
  }
  const trop = await s.executer({ nom: 'retenir', parametres: { information: 'Encore une information sur le vélo' } });
  assert.match(trop.erreur, /Limite/);
  assert.equal((await memoire.souvenirs()).length, LIMITES_ACTIONS.maxActionsParMessage);
  for (let i = 0; i < 10; i++) await s.executer({ nom: 'inconnue', parametres: {} });
  const bloque = await s.executer({ nom: 'retenir', parametres: { information: 'Encore une information sur le vélo' } });
  assert.match(bloque.erreur, /Trop de demandes/);
});

test('exécuteur : niveau « accord » — rien sans le oui de la personne ; « bloquee » jamais', async () => {
  const effets = [];
  const factice = (nom, niveau) => ({
    nom, niveau, description: 'd', parametres: { type: 'object', properties: {} },
    valider: () => ({ ok: true, parametres: {} }),
    executer: async () => { effets.push(nom); return { message: 'fait' }; },
    resumer: () => `faire ${nom}`,
    noter: () => `${nom} fait`,
  });
  const catalogue = creerCatalogue([factice('prendrePhoto', 'accord'), factice('toutEffacer', 'bloquee')]);
  const demandes = [];
  const refus = session({ catalogue, confirmer: async (d) => { demandes.push(d); return false; } });
  assert.equal((await refus.s.executer({ nom: 'prendrePhoto', parametres: {} })).ok, false);
  assert.deepEqual(demandes, [{ nom: 'prendrePhoto', resume: 'faire prendrePhoto' }]);
  assert.deepEqual(effets, []);
  assert.equal(refus.journal[0].statut, 'refusee');
  const oui = session({ catalogue, confirmer: async () => true });
  assert.equal((await oui.s.executer({ nom: 'prendrePhoto', parametres: {} })).ok, true);
  assert.deepEqual(effets, ['prendrePhoto']);
  const panne = session({ catalogue, confirmer: async () => { throw new Error('fenêtre fermée'); } });
  assert.equal((await panne.s.executer({ nom: 'prendrePhoto', parametres: {} })).ok, false, 'une confirmation en panne vaut un refus');
  const sansConfirmation = session({ catalogue });
  assert.equal((await sansConfirmation.s.executer({ nom: 'prendrePhoto', parametres: {} })).ok, false, 'par défaut : refus');
  assert.equal((await oui.s.executer({ nom: 'toutEffacer', parametres: {} })).ok, false);
  assert.deepEqual(effets, ['prendrePhoto']);
});

test('exécuteur : une action qui plante renvoie un échec, sans faire tomber la réponse', async () => {
  const cassee = {
    nom: 'casse', niveau: 'libre', description: 'd', parametres: { type: 'object', properties: {} },
    valider: () => ({ ok: true, parametres: {} }),
    executer: async () => { throw new Error('disque plein'); },
    resumer: () => 'casser', noter: (r) => (r.ok ? 'ok' : `échec : ${r.erreur}`),
  };
  const { journal, s } = session({ catalogue: creerCatalogue([cassee]) });
  const r = await s.executer({ nom: 'casse', parametres: {} });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /disque plein/);
  assert.equal(journal[0].statut, 'echec');
});
