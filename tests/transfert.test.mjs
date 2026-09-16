import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireFichier, lireFichier } from '../app/memoire/transfert.js';

const donnees = {
  cles: [{ cle: 'meta', valeur: { idNaissance: 'abcd1234-xyz', neeLe: '2026-09-16' } }],
  journal: [{ id: 1, role: 'moi', texte: 'Bonjour 😀 « guillemets » \u2028 fin', date: 'd' }, { id: 2, role: 'ia', texte: 'Salut', date: 'd' }],
  souvenirs: [{ id: 's1', texte: 'Aime le café', statut: 'actif' }, { id: 's2', texte: 'vieux', statut: 'archive' }],
  resumes: [],
  actions: [{ id: 'a-1', nom: 'retenir', statut: 'executee', parametres: { information: 'Aime le café' } }],
};
const maintenant = new Date('2026-09-16T12:00:00Z');

test('aller-retour fidèle, nom de fichier daté', async () => {
  const f = await construireFichier({ donnees, idNaissance: 'abcd1234-xyz', versionAppli: '0.4.0', maintenant });
  assert.equal(f.nom, 'naissance-abcd1234-2026-09-16.json');
  assert.ok(!f.contenu.includes('cle"') || !/AIza|AQ\./.test(f.contenu));
  const lu = await lireFichier(f.contenu);
  assert.equal(lu.ok, true);
  assert.deepEqual(lu.donnees, donnees);
  assert.equal(lu.resume.messages, 2);
  assert.equal(lu.resume.souvenirs, 1);
  assert.equal(lu.resume.idNaissance, 'abcd1234-xyz');
  assert.equal((await lireFichier(f.objet)).ok, true);
});

test('refus : pas du JSON, autre format, trop récent, abîmé, mal formé', async () => {
  const f = await construireFichier({ donnees, idNaissance: 'id', versionAppli: '0.4.0', maintenant });
  assert.match((await lireFichier('pas du json')).erreur, /pas un fichier JSON/);
  assert.match((await lireFichier('{"format":"autre"}')).erreur, /pas une mémoire/);
  assert.match((await lireFichier({ ...f.objet, schema: 99 })).erreur, /plus récente/);
  const abime = JSON.parse(f.contenu);
  abime.donnees.journal[0].texte = 'falsifié';
  assert.match((await lireFichier(abime)).erreur, /empreinte/);
  const malForme = await construireFichier({ donnees: { ...donnees, journal: [{ id: 'x', role: 'moi', texte: 't' }] }, idNaissance: 'id', versionAppli: 'v', maintenant });
  assert.match((await lireFichier(malForme.contenu)).erreur, /journal est mal formé/);
  const incomplet = await construireFichier({ donnees: { cles: [], journal: [], souvenirs: [], resumes: [] }, idNaissance: 'id', versionAppli: 'v', maintenant });
  assert.match((await lireFichier(incomplet.contenu)).erreur, /actions/);
  const actionMalFormee = await construireFichier({ donnees: { ...donnees, actions: [{ nom: 'retenir' }] }, idNaissance: 'id', versionAppli: 'v', maintenant });
  assert.match((await lireFichier(actionMalFormee.contenu)).erreur, /action du journal/);
});

import { empreinte } from '../app/memoire/transfert.js';

test('un fichier de l’ancien schéma 1 (v0.4–v0.5) reste importable', async () => {
  const anciennes = { cles: donnees.cles, journal: donnees.journal, souvenirs: donnees.souvenirs, resumes: [] };
  const fichier = {
    format: 'naissance', schema: 1, exporteLe: '2026-09-16T08:53:00Z', versionAppli: '0.4.0',
    idNaissance: 'abcd1234-xyz', empreinte: await empreinte(JSON.stringify(anciennes)), donnees: anciennes,
  };
  const lu = await lireFichier(JSON.stringify(fichier));
  assert.equal(lu.ok, true);
  assert.deepEqual(lu.donnees.actions, []);
  assert.equal(lu.resume.schema, 1);
  assert.equal(lu.donnees.journal.length, 2);
});

test('le nouveau fichier est en schéma 2 avec le journal des actions', async () => {
  const f = await construireFichier({ donnees, idNaissance: 'id', versionAppli: '0.6.0', maintenant });
  assert.equal(f.objet.schema, 2);
  assert.equal(JSON.parse(f.contenu).donnees.actions[0].nom, 'retenir');
});
