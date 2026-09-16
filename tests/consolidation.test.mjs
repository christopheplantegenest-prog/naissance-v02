import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGLES, decider, construireDemande, validerReponse, appliquerOperations, niveauSuperieur } from '../app/esprit/consolidation.js';
import { creerIdentite } from '../app/esprit/identite.js';

const maintenant = new Date('2026-09-16T10:00:00Z');
const base = (id, extra = {}) => ({
  id, texte: `souvenir ${id}`, categorie: 'autre', importance: 2, confiance: 'probable', source: 'dit',
  statut: 'actif', cree: 't0', modifie: 't0', nbRappels: 0, historique: [], ...extra,
});
let compteur = 0;
const nouvelId = () => `n${++compteur}`;

test('décider : seuils, absence, forçage, attente après échec', () => {
  const meta = {};
  const t = maintenant.getTime();
  assert.deepEqual(decider({ nbApresFil: 10, nbNonAnalyses: 4, meta, maintenant: t }), { resumer: false, extraire: false });
  assert.deepEqual(decider({ nbApresFil: 40, nbNonAnalyses: 12, meta, maintenant: t }), { resumer: true, extraire: true });
  assert.equal(decider({ nbApresFil: 2, nbNonAnalyses: 2, absence: true, meta, maintenant: t }).extraire, true);
  assert.equal(decider({ nbApresFil: 1, nbNonAnalyses: 1, force: true, meta, maintenant: t }).extraire, true);
  const echec = { echecConsolidation: new Date(t - 60000).toISOString() };
  assert.deepEqual(decider({ nbApresFil: 99, nbNonAnalyses: 99, meta: echec, maintenant: t }), { resumer: false, extraire: false });
  assert.equal(decider({ nbApresFil: 99, nbNonAnalyses: 99, meta: echec, force: true, maintenant: t }).resumer, true);
});

test('la demande contient les parties attendues et nomme la personne', () => {
  const identite = creerIdentite({ personne: 'Christophe', date: 'x' });
  const d = construireDemande({
    identite, fil: { texte: 'ancien' }, souvenirs: [base('s1'), base('s2', { statut: 'archive' })],
    aResumer: [], aAnalyser: [{ id: 5, role: 'moi', texte: 'J’ai un chat qui s’appelle Pixel' }],
  });
  assert.match(d.instructions, /UNIQUEMENT par un objet JSON/);
  assert.match(d.instructions, /jamais l'identité/);
  assert.match(d.entree, /\[s1\]/);
  assert.ok(!d.entree.includes('[s2]'));
  assert.match(d.entree, /A_RESUMER :\n\(vide\)/);
  assert.match(d.entree, /\[5\] Christophe : J’ai un chat/);
});

test('validation : rien d’incontrôlé n’est appliqué', () => {
  const v = validerReponse({
    resume: 'r'.repeat(5000),
    souvenirs: [
      { action: 'ajouter', texte: '  Christophe a un chat nommé Pixel  ', categorie: 'Préférence', importance: 9, source: 'dit' },
      { action: 'ajouter', texte: 'x' },
      { action: 'corriger', id: 'inconnu', texte: 'abc' },
      { action: 'oublier', id: 's1', raison: 'faux' },
      { action: 'confirmer', id: 's1' },
      { action: 'pirater', id: 's1' },
      { action: 'ajouter', texte: 'catégorie bizarre', categorie: 'zzz' },
    ],
  }, ['s1'], { resumeAttendu: true });
  assert.equal(v.resume.length, REGLES.maxResume);
  assert.deepEqual(v.operations.map((o) => o.action), ['ajouter', 'oublier', 'ajouter']);
  assert.equal(v.operations[0].texte, 'Christophe a un chat nommé Pixel');
  assert.equal(v.operations[0].categorie, 'preference');
  assert.equal(v.operations[0].importance, 3);
  assert.equal(v.operations[2].categorie, 'autre');
  assert.equal(v.operations[2].source, 'deduit');
  assert.equal(v.rejetees, 4);
  assert.equal(validerReponse({ resume: 'x' }, [], { resumeAttendu: false }).resume, null);
  assert.deepEqual(validerReponse('n’importe quoi', [], { resumeAttendu: true }).operations, []);
});

test('application : ajouter, doublon, corriger, oublier, confirmer', () => {
  const souvenirs = [base('s1', { texte: 'Christophe aime le café', confiance: 'incertain' }), base('s2'), base('s3')];
  const versions = { s1: 't0', s2: 't0', s3: 't0' };
  const { aEcrire, stats } = appliquerOperations({
    souvenirs, versions, maintenant, nouvelId, origine: { de: 1, a: 9 },
    operations: [
      { action: 'ajouter', texte: 'Christophe a un chat', categorie: 'personne', importance: 2, source: 'dit' },
      { action: 'ajouter', texte: 'christophe aime le CAFÉ !', categorie: 'preference', importance: 2, source: 'deduit' },
      { action: 'corriger', id: 's2', texte: 'nouveau texte', source: 'deduit' },
      { action: 'oublier', id: 's3', raison: 'obsolète' },
    ],
  });
  assert.deepEqual(stats, { ajoutes: 1, corriges: 1, oublies: 1, confirmes: 1, ignores: 0, archivesPourPlace: 0 });
  const parId = Object.fromEntries(aEcrire.map((s) => [s.id, s]));
  const nouveau = aEcrire.find((s) => s.texte === 'Christophe a un chat');
  assert.equal(nouveau.confiance, 'probable');
  assert.equal(nouveau.source, 'dit');
  assert.deepEqual(nouveau.origine, { de: 1, a: 9 });
  assert.equal(parId.s1.confiance, 'probable');
  assert.equal(parId.s2.texte, 'nouveau texte');
  assert.equal(parId.s2.confiance, 'incertain');
  assert.equal(parId.s2.source, 'dit', 'l’origine reste enregistrée');
  assert.equal(parId.s2.historique.at(-1).ancienTexte, 'souvenir s2');
  assert.equal(parId.s3.statut, 'archive');
  assert.equal(souvenirs[1].texte, 'souvenir s2', 'les objets d’origine ne sont pas modifiés');
});

test('un souvenir modifié par la personne pendant le rangement n’est pas écrasé', () => {
  const { aEcrire, stats } = appliquerOperations({
    souvenirs: [base('s1', { modifie: 't-personne' })], versions: { s1: 't0' }, maintenant, nouvelId,
    operations: [{ action: 'corriger', id: 's1', texte: 'version du moteur', source: 'dit' }], origine: null,
  });
  assert.equal(stats.ignores, 1);
  assert.equal(aEcrire.length, 0);
});

test('au-delà du plafond, les moins utiles sont archivés, jamais les manuels', () => {
  const beaucoup = Array.from({ length: REGLES.maxSouvenirsActifs }, (_, i) => base(`s${i}`, { importance: 1, confiance: 'incertain' }));
  beaucoup.push(base('manuel', { importance: 1, source: 'manuel', confiance: 'certain' }));
  const { aEcrire, stats } = appliquerOperations({
    souvenirs: beaucoup, versions: {}, maintenant, nouvelId, origine: null,
    operations: [{ action: 'ajouter', texte: 'important', categorie: 'autre', importance: 3, source: 'dit' }],
  });
  assert.equal(stats.archivesPourPlace, 2);
  const archives = aEcrire.filter((s) => s.statut === 'archive').map((s) => s.id);
  assert.ok(!archives.includes('manuel'));
  assert.ok(aEcrire.some((s) => s.texte === 'important' && s.statut === 'actif'));
});

test('niveaux de confiance', () => {
  assert.equal(niveauSuperieur('incertain'), 'probable');
  assert.equal(niveauSuperieur('probable'), 'certain');
  assert.equal(niveauSuperieur('certain'), 'certain');
});
