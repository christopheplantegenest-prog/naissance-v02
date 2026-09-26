// === DIAGNOSTIC TEMPORAIRE — reproduction de l'échec téléphone v0.17.15 ===
// Aucune correction de production n'accompagne ce fichier. Objectif : reproduire par test
// automatisé le symptôme réel (import « en place » sur un magasin déjà repeuplé après l'export
// conserve une expérience qui aurait dû disparaître), AVANT toute correction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerMagasinMemoire } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { magasinMemoireVive, enregistrerExperience } from '../app/langage/connaissances.js';
import { construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete } from '../app/memoire/sauvegarde.js';
import { TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';

// -------------------------------------------------------------------------------------------
// TEST 1 (obligatoire) — import EN PLACE, chemin de RÉUSSITE réel de remplacerTout()
// -------------------------------------------------------------------------------------------
test('[DIAGNOSTIC] import en place : une expérience ajoutée APRÈS export dans le MÊME magasin doit disparaître après import réussi', async () => {
  const magasinLangage = magasinMemoireVive();
  const memoire = creerMemoire(creerMagasinMemoire());

  const expA = await enregistrerExperience(magasinLangage, {
    texteRecu: 'Bibendumesque ?', texteRepondu: 'Je ne sais pas.',
    date: '2026-09-26T10:00:00.000Z', source: 'laboratoire',
  });
  const expB = await enregistrerExperience(magasinLangage, {
    texteRecu: 'Quelle est ma bibendumesque ?', texteRepondu: 'Je ne sais pas encore.',
    date: '2026-09-26T10:01:00.000Z', source: 'laboratoire',
  });

  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({
    memoire, magasinLangage, idNaissance: meta.idNaissance, versionAppli: 'diag', maintenant: new Date('2026-09-26T10:02:00Z'),
  });

  // Trucbidulesque : ajoutée dans LE MÊME magasin, APRÈS l'export.
  await enregistrerExperience(magasinLangage, {
    texteRecu: 'Trucbidulesque ?', texteRepondu: 'Je ne sais pas.',
    date: '2026-09-26T10:03:00.000Z', source: 'laboratoire',
  });
  const avantImport = await magasinLangage.lireTout('experiences');
  assert.equal(avantImport.length, 3, 'fixture : 3 expériences présentes juste avant import (A, B, Trucbidulesque)');

  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true);

  // Import EN PLACE : même magasin que celui utilisé pour l'export (comme sur le téléphone,
  // via ecranLangage.assurerEsprit() réutilisé par memoire/ecran.js).
  await importerSauvegardeComplete({ memoire, magasinLangage, donnees: lu.donnees });

  const apresImport = await magasinLangage.lireTout('experiences');
  const textes = apresImport.map((e) => e.texteRecu).sort();
  assert.deepEqual(textes, ['Bibendumesque ?', 'Quelle est ma bibendumesque ?'],
    'Trucbidulesque doit avoir disparu : seules A et B doivent rester après import réussi en place');
  assert.equal(apresImport.length, 2);
});

// -------------------------------------------------------------------------------------------
// TEST 2+3 (obligatoire) — chemin RÉEL de dispatch (formatDeposeDe → importerCompletDepuis /
// importerAncienDepuis) ET câblage réel (ecranLangage.assurerEsprit() partagé, comme main.js)
// -------------------------------------------------------------------------------------------
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
class Faux {
  constructor() { this.listeners = {}; this.disabled = false; this.hidden = false; this.textContent = ''; this.value = ''; this.files = null; this.className = ''; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  append() {}
  appendChild() {}
  async declencher(t) { for (const f of this.listeners[t] || []) await f({ preventDefault() {} }); }
  append() {}
  appendChild() {}
  replaceChildren() {}
  querySelector() { return new Faux(); }
}
globalThis.document = { createElement: () => universel() };
globalThis.window = globalThis;

const { monterEcranLangage } = await import('../app/langage/ecran.js');
const { monterEcranMemoire } = await import('../app/memoire/ecran.js');

test('[DIAGNOSTIC] câblage réel : fichier complet réellement dispatché vers importerCompletDepuis (naissance-langage modifiée), pas vers l\'import mémoire-seule', async () => {
  // --- ecranLangage réel : SEUL propriétaire du magasin langage, exactement comme dans main.js ---
  const magasinReel = magasinMemoireVive();
  const elLangage = { lister: new Faux(), etat: new Faux(), rapport: new Faux() };
  elLangage.rapport.hidden = true;
  const zoneLangage = {
    querySelector: (sel) => {
      const m = sel.match(/^\[data-langage-experiences-([a-z]+)\]$/);
      return m ? elLangage[m[1]] : universel();
    },
  };
  const ecranLangage = monterEcranLangage({ zone: zoneLangage, ouvrirStockage: async () => magasinReel, confirmer: () => true });
  // main.js : magasinLangage: async () => (await ecranLangage.assurerEsprit()).magasin
  const magasinLangage = async () => (await ecranLangage.assurerEsprit()).magasin;

  await enregistrerExperience(await magasinLangage(), {
    texteRecu: 'Bibendumesque ?', texteRepondu: 'Je ne sais pas.', date: '2026-09-26T10:00:00.000Z', source: 'laboratoire',
  });
  await enregistrerExperience(await magasinLangage(), {
    texteRecu: 'Quelle est ma bibendumesque ?', texteRepondu: 'Je ne sais pas encore.', date: '2026-09-26T10:01:00.000Z', source: 'laboratoire',
  });

  const memoire = creerMemoire(creerMagasinMemoire());
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({
    memoire, magasinLangage: await magasinLangage(), idNaissance: meta.idNaissance, versionAppli: 'diag', maintenant: new Date('2026-09-26T10:02:00Z'),
  });
  assert.equal(fichier.objet.format, 'naissance-sauvegarde-complete');

  // Trucbidulesque, écrite dans le MÊME magasin après l'export (comme sur le téléphone).
  await enregistrerExperience(await magasinLangage(), {
    texteRecu: 'Trucbidulesque ?', texteRepondu: 'Je ne sais pas.', date: '2026-09-26T10:03:00.000Z', source: 'laboratoire',
  });

  // --- panneau minimal pour monterEcranMemoire : les sélecteurs réellement lus au montage ---
  const dict = new Map();
  for (const sel of [
    '[data-bloc-identite]', '[data-liste-souvenirs]', '[data-liste-archives]', '[data-zone-archives]',
    '[data-nb-souvenirs]', '[data-fil]', '[data-info-export]', '[data-resultat-memoire]',
    '[data-restaurer]', '[data-info-rangement]', '[data-nouveau-souvenir]', '[data-nouvelle-categorie]',
    '[data-journal-actions]',
  ]) dict.set(sel, new Faux());
  const choixFichier = new Faux();
  dict.set('[data-fichier]', choixFichier);
  const panneau = { querySelector: (sel) => dict.get(sel) || universel() };

  const ecranMemoire = monterEcranMemoire({
    panneau, memoire, esprit: {}, versionAppli: 'diag',
    moteurLibelle: () => null,
    magasinLangage,
    surChangement: () => {},
    confirmer: () => true,
  });
  void ecranMemoire;

  // Dépose le VRAI fichier produit par construireSauvegardeComplete(), en repassant par
  // fichier.text() comme le ferait un vrai <input type="file"> sur téléphone.
  choixFichier.files = [{ text: async () => fichier.contenu }];
  await choixFichier.declencher('change');

  // Preuve du chemin choisi : si importerCompletDepuis a réellement été appelé, naissance-langage
  // (le magasin RÉEL, partagé via ecranLangage.assurerEsprit) doit être repassé à [A, B] --
  // Trucbidulesque disparu. Si le chemin ancien (mémoire seule) avait été pris par erreur, les 3
  // expériences resteraient intactes : le test échouerait ici et prouverait la vraie cause.
  const experiencesReelles = await (await magasinLangage()).lireTout('experiences');
  const textes = experiencesReelles.map((e) => e.texteRecu).sort();
  assert.deepEqual(textes, ['Bibendumesque ?', 'Quelle est ma bibendumesque ?'],
    'le fichier complet doit avoir été dispatché vers importerCompletDepuis (naissance-langage modifiée)');

  // Second témoin, via le VRAI bouton « Afficher les expériences » du laboratoire (même esprit
  // partagé) : ce que Christophe a réellement cliqué sur le téléphone.
  await elLangage.lister.declencher('click');
  assert.match(elLangage.etat.textContent, /2 expérience/, 'le laboratoire doit afficher 2 expériences, pas 3');
  assert.ok(!elLangage.rapport.textContent.includes('Trucbidulesque'), 'Trucbidulesque ne doit plus apparaître dans « Voir les expériences »');
});
