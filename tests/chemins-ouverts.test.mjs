// v0.64.0 — CHEMINS OUVERTS DE L'ÉPISODE PRÉSENT (décision ChatGPT « DÉCISION v0.64.0 », 12/10/2026).
// cheminsOuverts : règle structurelle unique (extraite telle quelle de contextesProspectifs) ; .74 ne forme plus d'attente sur un chemin déjà
// connu dans la partie connue de l'épisode présent. Preuves : feuilles, conteneurs, chemins absents, relationValeur, étapes partielles ; cas central
// « départ salut connu ≠ arrivée oui connue » ; aucune attente nouvelle ; contexte persisté inchangé ; aucune co-couverture branchée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { cheminsOuverts } from '../app/langage/contexte-prospectif.js';
import { partieConnueEpisode } from '../app/langage/episodes-de-transformation.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { attentePlate } from './projection-attente.mjs'; // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : projection de vérification vers la forme plate .64.6 (même information)

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const S2 = 'symbolesDeChaine(chaine)>environnement:conversation(emis)';
const noms = (l) => l.map((c) => c.chemin.join('.'));

// ------------------------------------------------------------------------------------------------------------------------------- règle structurelle
test('RÈGLE. feuilles, conteneurs, chemins absents, relationValeur, étapes partielles : connu = occurrence de la partie connue', () => {
  const partie = { depart: 'm', chemin: [{ de: 'm', execution: 'x', operation: 'f', entrees: ['a'], vers: 'x' }, { de: 'x', operation: 'g', entrees: ['b'] }], valeurs: { depart: 'salut' } };
  const historiques = ['depart', 'arrivee', 'chemin.0.execution', 'chemin.1.de', 'chemin.1.execution', 'chemin.1.vers', 'relationValeur', 'valeurs', 'valeurs.depart', 'valeurs.arrivee', 'valeurs.depart.0']
    .map((p) => ({ chemin: p.split('.').map((x) => (/^\d+$/.test(x) ? Number(x) : x)), constats: [] }));
  assert.deepEqual(noms(cheminsOuverts(historiques, partie)), ['arrivee', 'chemin.1.execution', 'chemin.1.vers', 'relationValeur', 'valeurs.arrivee', 'valeurs.depart.0']);
  // feuille connue (valeurs.depart), conteneur connu (valeurs, présent comme objet), étape connue (chemin.1.de) : fermés ;
  // feuille absente (valeurs.arrivee), identités futures (chemin.1.execution/vers, arrivee), relationValeur absente : ouverts ;
  // un chemin SOUS une feuille connue (valeurs.depart.0) n'est pas une occurrence : ouvert (aucune règle ad hoc ; il ne peut exister dans une issue).
  const sansValeur = { depart: 'm', chemin: [] };
  assert.deepEqual(noms(cheminsOuverts(historiques, sansValeur)).filter((p) => p.startsWith('valeurs')), ['valeurs', 'valeurs.depart', 'valeurs.arrivee', 'valeurs.depart.0'], 'départ sans valeur connue : le conteneur reste ouvert');
  const historiquesGeles = Object.freeze(historiques.map((h) => Object.freeze(h)));
  assert.equal(cheminsOuverts(historiquesGeles, partie)[0], historiques[1], 'mêmes objets, même ordre, entrées intactes');
  assert.throws(() => cheminsOuverts('x', partie), TypeError);
});

// ------------------------------------------------------------------------------------------------------------------------------- vécu réel
function monde() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); await consequenceReception(magasin, d.reception); await traiterOccasion(magasin, d.reception.id); }
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function emettre(texte) {
    const s = await tour(texte);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).filter((m) => m.idObservation === s.observation.id).find((m) => ex.find((q) => q.id === m.idExecution).operation === 'symbolesDeChaine');
  }
  async function tick(k) { for (let i = 0; i < k; i += 1) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  return { magasin, tour, emettre, tick };
}
async function histoire(paires, present) {
  const w = monde();
  for (const [x, y] of paires) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tick(2); }
  const E = await w.emettre(present);
  const contexte = (await w.magasin.lireTout('contextesProspectifs')).find((c) => c.idDesignation === E.id && vue(c.structure) === S2);
  const lignes = (await w.magasin.lireTout('attentesProspectives')).map(attentePlate).filter((a) => a.idContexte === contexte.id); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  // MISE À JOUR DÉLIBÉRÉE v0.64.1 (attente conditionnée par la partie connue) : `attentes` = source .74 (règle de ce fichier) ; `conditionnees` = source
  // co-couverture (champ `fondation`), vérifiée en détail dans attentes-conditionnees.test.mjs.
  const attentes = lignes.filter((a) => !Object.hasOwn(a, 'fondation')); const conditionnees = lignes.filter((a) => Object.hasOwn(a, 'fondation'));
  return { w, E, contexte, attentes, conditionnees, v: await lireExecutionsVecues(w.magasin) };
}

test('CENTRAL. historique salut→oui ; présent salut : départ connu (valeurs.depart = salut), non ouvert ; arrivée ouverte ; AUCUNE attente « oui » déduite du départ', async () => {
  const { contexte, attentes, conditionnees, v } = await histoire([['x', 'y'], ['bonjour', 'merci'], ['salut', 'oui']], 'salut');
  const partie = partieConnueEpisode(contexte.episodePartiel, v.valeurs, v.executions, v.descriptions);
  assert.deepEqual(partie.valeurs, { depart: 'salut' });
  const persistes = noms(contexte.chemins);
  assert.ok(persistes.includes('valeurs.depart') && persistes.includes('valeurs.arrivee'), 'le contexte persisté garde sa règle historique (episodePartiel)');
  const ouverts = noms(cheminsOuverts(contexte.chemins, partie));
  assert.equal(ouverts.includes('valeurs.depart'), false); assert.equal(ouverts.includes('valeurs'), false);
  assert.ok(ouverts.includes('valeurs.arrivee') && ouverts.includes('relationValeur') && ouverts.includes('arrivee'));
  assert.equal(attentes.some((a) => a.chemin[0] === 'valeurs' && a.chemin.length < 2), false, 'aucune attente sur le conteneur');
  assert.equal(attentes.some((a) => a.chemin.join('.') === 'valeurs.depart'), false, 'aucune attente sur le départ connu');
  assert.equal(attentes.some((a) => a.chemin.join('.') === 'valeurs.arrivee'), false, '« je sais que le départ est salut » ≠ « je sais que l’arrivée sera oui »');
  // v0.64.1 : ce passage du départ connu à l'arrivée n'est fait QUE par la source conditionnée, fondée sur la classe exacte de l'histoire
  assert.deepEqual(conditionnees.filter((a) => a.chemin.join('.') === 'valeurs.arrivee').map((a) => [a.constat, a.fondation[0].conditions.map((c) => c.chemin.join('.'))]), [[{ type: 'chaine', valeur: 'oui' }, ['valeurs.depart']]]);
});

test('PRÉSENT DIFFÉRENT DE L’HISTOIRE : départ universel « salut » dans l’histoire, présent « bonjour » : plus d’attente absurde valeurs.depart = salut', async () => {
  const { contexte, attentes, conditionnees, v } = await histoire([['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui']], 'bonjour');
  assert.deepEqual(partieConnueEpisode(contexte.episodePartiel, v.valeurs, v.executions, v.descriptions).valeurs, { depart: 'bonjour' });
  assert.equal(attentes.some((a) => a.chemin.join('.') === 'valeurs.depart'), false);
  // l'attente universelle .74 sur l'arrivée (toutes les unités passées : « oui ») reste celle d'avant : rien n'est appris du départ
  assert.deepEqual(attentes.filter((a) => a.chemin.join('.') === 'valeurs.arrivee').map((a) => a.constat), [{ type: 'chaine', valeur: 'oui' }]);
  // v0.64.1 : la source conditionnée engage « merci » sur le même chemin ; les deux lignes coexistent, aucune n'annule l'autre (rapporté)
  assert.deepEqual(conditionnees.filter((a) => a.chemin.join('.') === 'valeurs.arrivee').map((a) => a.constat), [{ type: 'chaine', valeur: 'merci' }]);
});

test('AUCUNE ATTENTE NOUVELLE : les attentes formées sont exactement celles de la règle .74 restreinte aux chemins ouverts', async () => {
  const { w, E, contexte, attentes, v } = await histoire([['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui']], 'salut');
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  // .74 recalculé sur le même vécu « avant » avec un contexte dont TOUS les chemins seraient ouverts (départ inconnu) : sur-ensemble strict
  const sansDepart = { ...contexte, episodePartiel: { ...contexte.episodePartiel, depart: contexte.episodePartiel.chemin[0].vers } };
  const avant = v.executions.filter((e) => e.horodatage <= E.horodatage);
  const restreintes = attentesDuContexteProspectif(contexte, { id: E.id, horodatage: E.horodatage }, contextes, v.valeurs, avant, v.descriptions).map(attentePlate); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  const toutes = attentesDuContexteProspectif(sansDepart, { id: E.id, horodatage: E.horodatage }, contextes, v.valeurs, avant, v.descriptions).map(attentePlate);
  const cle = (a) => `${a.chemin.join('.')}=${JSON.stringify(a.constat)}`;
  assert.ok(restreintes.every((a) => toutes.some((b) => cle(b) === cle(a))), 'aucune attente qui n’existait pas sans la restriction');
  assert.deepEqual(toutes.filter((b) => !restreintes.some((a) => cle(a) === cle(b))).map((a) => a.chemin.join('.')).sort(), ['valeurs', 'valeurs.depart'], 'seuls les chemins connus disparaissent');
  assert.deepEqual(restreintes.map(cle).sort(), attentes.map(cle).sort(), 'identique aux attentes persistées par le flux réel');
});

test('GARDES : aucune co-couverture, aucune attente conditionnée ; règle partagée (une seule implémentation)', () => {
  const ap = readFileSync(join(RACINE, 'app', 'langage', 'attentes-prospectives.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/coCouvertures|co-couvertures|conditionn|probab|frequen|score/i.test(ap), false);
  const cp = readFileSync(join(RACINE, 'app', 'langage', 'contexte-prospectif.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal((cp.match(/parcourirStructure\(/g) || []).length, 1, 'le calcul des chemins connus n’existe qu’une fois (cheminsOuverts)');
  assert.ok(cp.includes('chemins = cheminsOuverts(histoire.chemins, projection.episodePartiel);'));
});
