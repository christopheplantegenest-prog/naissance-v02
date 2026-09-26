// === DIAGNOSTIC TEMPORAIRE — preuve que l'instrumentation visible de l'import (ajoutée dans
// app/memoire/ecran.js pour une capture d'écran téléphone) NE CHANGE RIEN au comportement réel :
// mêmes données remplacées en cas de succès, aucune écriture en cas d'annulation, aucune exception
// masquée en cas d'échec. À retirer avec l'instrumentation elle-même une fois la cause confirmée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerMagasinMemoire } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { magasinMemoireVive, enregistrerExperience } from '../app/langage/connaissances.js';
import { construireSauvegardeComplete } from '../app/memoire/sauvegarde.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
class Faux {
  constructor() { this.listeners = {}; this.disabled = false; this.hidden = false; this.textContent = ''; this.value = ''; this.files = null; this.className = ''; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
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

async function monterScenario({ confirmer }) {
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
  const magasinLangage = async () => (await ecranLangage.assurerEsprit()).magasin;

  await enregistrerExperience(await magasinLangage(), { texteRecu: 'Bibendumesque ?', texteRepondu: 'Je ne sais pas.', date: '2026-09-26T10:00:00.000Z', source: 'laboratoire' });
  await enregistrerExperience(await magasinLangage(), { texteRecu: 'Quelle est ma bibendumesque ?', texteRepondu: 'Je ne sais pas encore.', date: '2026-09-26T10:01:00.000Z', source: 'laboratoire' });

  const memoire = creerMemoire(creerMagasinMemoire());
  const meta = await memoire.meta();
  const fichier = await construireSauvegardeComplete({
    memoire, magasinLangage: await magasinLangage(), idNaissance: meta.idNaissance, versionAppli: 'diag', maintenant: new Date('2026-09-26T10:02:00Z'),
  });

  await enregistrerExperience(await magasinLangage(), { texteRecu: 'Trucbidulesque ?', texteRepondu: 'Je ne sais pas.', date: '2026-09-26T10:03:00.000Z', source: 'laboratoire' });

  const dict = new Map();
  for (const sel of [
    '[data-bloc-identite]', '[data-liste-souvenirs]', '[data-liste-archives]', '[data-zone-archives]',
    '[data-nb-souvenirs]', '[data-fil]', '[data-info-export]',
    '[data-restaurer]', '[data-info-rangement]', '[data-nouveau-souvenir]', '[data-nouvelle-categorie]',
    '[data-journal-actions]',
  ]) dict.set(sel, new Faux());
  const resultat = new Faux();
  dict.set('[data-resultat-memoire]', resultat);
  const choixFichier = new Faux();
  dict.set('[data-fichier]', choixFichier);
  const panneau = { querySelector: (sel) => dict.get(sel) || universel() };

  monterEcranMemoire({
    panneau, memoire, esprit: {}, versionAppli: 'diag', moteurLibelle: () => null,
    magasinLangage, surChangement: () => {}, confirmer,
  });

  choixFichier.files = [{ name: 'sauvegarde.json', size: fichier.contenu.length, text: async () => fichier.contenu }];
  await choixFichier.declencher('change');

  const apres = await (await magasinLangage()).lireTout('experiences');
  return { resultat, apresLangage: apres.map((e) => e.texteRecu).sort() };
}

test('[GARDE INSTRUMENTATION] succès : mêmes données remplacées qu\'avant instrumentation (A, B ; Trucbidulesque disparu)', async () => {
  const { resultat, apresLangage } = await monterScenario({ confirmer: () => true });
  assert.deepEqual(apresLangage, ['Bibendumesque ?', 'Quelle est ma bibendumesque ?']);
  assert.equal(resultat.hidden, false);
  assert.match(resultat.className, /resultat-ok/);
  // La trace doit être visible ET complète (les 11 points demandés, sous une forme ou une autre).
  for (const attendu of [
    'fichier sélectionné', 'format détecté', 'complet', 'confirmation demandée', 'confirmation renvoyée',
    'importerSauvegardeComplete() appelé', 'AVANT remplacement', 'sauvegarde lue', 'terminé sans exception',
    'APRÈS remplacement', 'apresModification() terminé',
  ]) assert.ok(resultat.textContent.includes(attendu), `trace manquante : "${attendu}"`);
});

test('[GARDE INSTRUMENTATION] confirmation refusée (false) : AUCUNE écriture, comme avant instrumentation', async () => {
  const { resultat, apresLangage } = await monterScenario({ confirmer: () => false });
  assert.deepEqual(apresLangage, ['Bibendumesque ?', 'Quelle est ma bibendumesque ?', 'Trucbidulesque ?'].sort(),
    'aucune écriture ne doit avoir eu lieu : les 3 expériences doivent toutes être encore là');
  assert.match(resultat.className, /resultat-attente/);
  assert.ok(resultat.textContent.includes('Import annulé.'));
  assert.ok(resultat.textContent.includes('confirmation renvoyée : false'));
});

test('[GARDE INSTRUMENTATION] confirmation « undefined » (cas suspecté sur le téléphone) : traité comme une annulation, AUCUNE écriture, valeur exacte visible dans la trace', async () => {
  const { resultat, apresLangage } = await monterScenario({ confirmer: () => undefined });
  assert.deepEqual(apresLangage, ['Bibendumesque ?', 'Quelle est ma bibendumesque ?', 'Trucbidulesque ?'].sort());
  assert.ok(resultat.textContent.includes('confirmation renvoyée : undefined (typeof undefined)'),
    'la trace doit distinguer explicitement "undefined" de "false" -- utile pour identifier une confirmation jamais réellement affichée');
});

test('[GARDE INSTRUMENTATION] confirmation qui lève une exception : erreur affichée, JAMAIS masquée, aucune écriture', async () => {
  const { resultat, apresLangage } = await monterScenario({ confirmer: () => { throw new Error('confirm() indisponible sur ce WebView'); } });
  assert.deepEqual(apresLangage, ['Bibendumesque ?', 'Quelle est ma bibendumesque ?', 'Trucbidulesque ?'].sort());
  assert.match(resultat.className, /resultat-erreur/);
  assert.ok(resultat.textContent.includes('confirm() indisponible sur ce WebView'),
    'le message d\'exception réel doit apparaître intégralement dans la trace affichée, jamais avalé silencieusement');
});
