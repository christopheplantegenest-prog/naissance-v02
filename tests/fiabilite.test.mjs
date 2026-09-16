import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executerAvecRepli, verifierModeles, noteDeRepli, REGLES_FIABILITE } from '../app/fournisseurs/fiabilite.js';
import { ErreurFournisseur } from '../app/fournisseurs/erreurs.js';
import { lireSante, etatModele, noterEchec } from '../app/fournisseurs/sante.js';
import { fauxStockage } from './outils.mjs';

const T = Date.parse('2026-09-16T10:00:00Z');
const fournisseur = { id: 'g', ordonnerModeles: (l) => l };
const modeles = ['models/a', 'models/b', 'models/c', 'models/d'].map((id) => ({ id }));
const erreur = (code) => new ErreurFournisseur(code, `erreur ${code}`, `détail ${code}`);

function montage(comportement) {
  const appels = [];
  const attentes = [];
  const stockage = fauxStockage();
  let t = T;
  const tache = async (modele) => {
    appels.push(modele);
    const r = comportement(modele, appels.filter((m) => m === modele).length);
    if (r instanceof Error) throw r;
    return `réponse de ${modele}`;
  };
  const lancer = (options = {}) => executerAvecRepli({
    fournisseur, prefere: 'models/a', modeles, tache, stockage,
    horloge: () => new Date(t), attendre: async (ms) => { attentes.push(ms); t += ms; }, ...options,
  });
  return { appels, attentes, stockage, lancer, avancer: (ms) => { t += ms; } };
}

test('tout va bien : un seul appel, aucun repli, modèle confirmé', async () => {
  const m = montage(() => 'ok');
  const r = await m.lancer();
  assert.equal(r.resultat, 'réponse de models/a');
  assert.equal(r.repli, null);
  assert.deepEqual(m.appels, ['models/a']);
  assert.ok(etatModele(lireSante(m.stockage), 'g', 'models/a').succes);
});

test('503 passager : une relance après un court délai suffit', async () => {
  const m = montage((modele, n) => (n === 1 ? erreur('service') : 'ok'));
  const r = await m.lancer();
  assert.equal(r.modele, 'models/a');
  assert.equal(r.repli, null);
  assert.deepEqual(m.appels, ['models/a', 'models/a']);
  assert.deepEqual(m.attentes, [REGLES_FIABILITE.delaiRelanceMs]);
});

test('503 persistant : repli vers un autre modèle, modèle saturé mis en pause', async () => {
  const m = montage((modele) => (modele === 'models/a' ? erreur('service') : 'ok'));
  const r = await m.lancer();
  assert.equal(r.modele, 'models/b');
  assert.deepEqual(r.repli, { de: 'models/a', vers: 'models/b', code: 'service', definitif: false });
  assert.deepEqual(m.appels, ['models/a', 'models/a', 'models/b']);
  assert.match(noteDeRepli(r.repli), /Réponse donnée par b : a ne répond pas pour le moment/);
  const suite = await m.lancer();
  assert.equal(suite.modele, 'models/b', 'le modèle en pause n’est pas rappelé tout de suite');
  assert.equal(suite.repli.code, 'attente');
  assert.equal(m.appels.length, 4);
});

test('modèle disparu (404) : pas de relance, repli définitif', async () => {
  const m = montage((modele) => (modele === 'models/a' ? erreur('modele') : 'ok'));
  const r = await m.lancer();
  assert.deepEqual(m.appels, ['models/a', 'models/b']);
  assert.equal(r.repli.definitif, true);
  assert.match(noteDeRepli(r.repli), /a n'est plus disponible : Naissance utilise désormais b/);
});

test('quota ou délai : on change de modèle sans relancer le même', async () => {
  const m = montage((modele) => (modele === 'models/a' ? erreur('quota') : modele === 'models/b' ? erreur('delai') : 'ok'));
  const r = await m.lancer();
  assert.deepEqual(m.appels, ['models/a', 'models/b', 'models/c']);
  assert.equal(r.modele, 'models/c');
  assert.deepEqual(m.attentes, []);
});

test('erreur de clé ou message bloqué : arrêt immédiat, aucun repli inutile', async () => {
  for (const code of ['cle', 'acces', 'bloque', 'requete']) {
    const m = montage(() => erreur(code));
    await assert.rejects(m.lancer(), { code });
    assert.equal(m.appels.length, 1, code);
  }
});

test('aucun modèle ne répond : erreur « indisponible », appels plafonnés, rien de confirmé', async () => {
  const m = montage(() => erreur('service'));
  await assert.rejects(m.lancer(), (e) => {
    assert.equal(e.code, 'indisponible');
    assert.match(e.message, /Aucun modèle n’a pu répondre/);
    assert.match(e.detail, /a : service.*b : service.*c : service/);
    return true;
  });
  assert.equal(m.appels.length, REGLES_FIABILITE.maxModeles * (REGLES_FIABILITE.relances + 1));
  assert.ok(!m.appels.includes('models/d'));
});

test('quotas épuisés partout : message adapté', async () => {
  const m = montage(() => erreur('quota'));
  await assert.rejects(m.lancer(), (e) => /quotas gratuits/.test(e.message));
});

test('tous les modèles en pause : on retente quand même le modèle choisi', async () => {
  const m = montage(() => 'ok');
  for (const x of modeles) noterEchec('g', x.id, { code: 'service' }, new Date(T).toISOString(), m.stockage);
  const r = await m.lancer();
  assert.equal(r.modele, 'models/a');
  assert.deepEqual(m.appels, ['models/a']);
});

test('un modèle choisi hors de la liste est quand même essayé en premier', async () => {
  const m = montage(() => 'ok');
  const r = await m.lancer({ prefere: 'models/nouveau', modeles: [] });
  assert.equal(r.modele, 'models/nouveau');
});

test('vérification réelle : s’arrête au premier modèle qui répond', async () => {
  const stockage = fauxStockage();
  const sondes = [];
  const f = {
    id: 'g',
    ordonnerModeles: (l) => l,
    sonder: async ({ modele, cle }) => {
      sondes.push(modele);
      assert.equal(cle, 'k');
      if (modele === 'models/a') throw erreur('modele');
      return true;
    },
  };
  const v = await verifierModeles({ fournisseur: f, acces: { cle: 'k', methode: 'entete' }, prefere: 'models/a', modeles, stockage });
  assert.equal(v.modele, 'models/b');
  assert.deepEqual(sondes, ['models/a', 'models/b']);
  assert.deepEqual(v.essais.map((e) => e.ok), [false, true]);
  assert.equal(etatModele(lireSante(stockage), 'g', 'models/a').code, 'modele');
  const cleRefusee = await verifierModeles({
    fournisseur: { ...f, sonder: async () => { throw erreur('cle'); } },
    acces: { cle: 'k' }, prefere: 'models/c', modeles, stockage,
  });
  assert.equal(cleRefusee.modele, null);
  assert.equal(cleRefusee.erreur.code, 'cle');
});
