// === DEBUT_TEST_PROVENANCE_LIAISONS ===
// v0.62.3 — ÉTAPE 6, décision ChatGPT « PROVENANCE EXACTE DES LIAISONS » (03/10/2026), suite au
// diagnostic « PROVENANCE DES LIAISONS » : le mécanisme de composition perdait deux faits bruts
// connus au moment de l'action (la liaison réellement choisie, la trace qui a produit le résultat
// source). On les CONSERVE désormais dans la trace de B (champ additif `provenanceLiaisons`), sans
// rien reconstruire plus tard et sans rien changer au comportement fonctionnel.
//
// Ces tests exercent les VRAIS appels (tenterReconnaissanceAction, invoquerComposition,
// tenterRejeuAutonome, confirmerLiaison) sur le vrai écran de langage, comme
// tests/composition-ecran.test.mjs et tests/rejeu-autonome.test.mjs. Domaine ARTIFICIEL neutre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { apprendreFait, apprendreRegle, chargerEsprit } from '../app/langage/esprit.js';
import {
  magasinMemoireVive, apprendreAction, enregistrerTrace, TABLES,
} from '../app/langage/connaissances.js';
import { evaluerAction } from '../app/langage/action.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import {
  enregistrerResultat, noterOrigineResultat, invoquerAvecLiaisons, valeurLiee,
} from '../app/langage/composition.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});

// Magasin dont l'écriture de la table 'traces' peut être coupée à volonté (panne de persistance).
function magasinFragile() {
  const base = magasinMemoireVive();
  const etat = { panne: false };
  return {
    etat,
    ...base,
    async ecrire(table, objet) {
      if (etat.panne && table === 'traces') throw new Error('PANNE traces');
      return base.ecrire(table, objet);
    },
  };
}

const L_DEDUCTION_RELATION = {
  capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
};

async function monter({ liaison = true } = {}) {
  const magasin = magasinFragile();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(e, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(e, { role: 'zrole1', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zcouleur' });
  await apprendreRegle(e, { role: 'zrole2', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'ztaille' });
  const ev = evaluerAction({
    operation: 'deduction', roles: ['sujet', 'role'], exemples: ['zdeduit zorbo zrole1', 'zdeduit zkelmi zrole1', 'zdeduit zorbo zrole2'],
  });
  await apprendreAction(magasin, { ...ev, operation: 'deduction' });
  e.actions = await magasin.lireTout('actions');
  if (liaison) await ecran.confirmerLiaison(L_DEDUCTION_RELATION);
  return { magasin, ecran, e };
}

const traceDe = async (magasin, id) => (await magasin.lireTout('traces')).find((t) => t.id === id);
const composerB = (ecran, extra = {}) => ecran.invoquerComposition({
  operation: 'confrontation', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi', ...extra },
});

// ============================================================================ TESTS CENTRAUX
test('A1 -> A2 -> B, résultats A1/A2 IDENTIQUES : B pointe exactement vers la trace A2 et la liaison choisie', async () => {
  const { ecran, magasin, e } = await monter();
  const r1 = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  const r2 = await ecran.tenterReconnaissanceAction('zdeduit zkelmi zrole1');
  assert.notEqual(r1.idTrace, r2.idTrace);
  const trA1 = await traceDe(magasin, r1.idTrace);
  const trA2 = await traceDe(magasin, r2.idTrace);
  assert.deepEqual(trA1.resultat, trA2.resultat, 'précondition : résultats complets identiques');

  const b = await composerB(ecran);
  assert.equal(b.ok, true);
  const trB = await traceDe(magasin, b.idTrace);
  const liaison = e.liaisons[0];
  assert.equal(typeof liaison.id, 'string');
  assert.deepEqual(trB.provenanceLiaisons, { relation: { idTraceSource: r2.idTrace, idLiaison: liaison.id } });
  assert.notEqual(trB.provenanceLiaisons.relation.idTraceSource, r1.idTrace, 'jamais A1');
  // provenanceArguments (rôle -> chaîne) reste INTACT.
  assert.deepEqual(trB.provenanceArguments, { sujetA: 'explicite', sujetB: 'explicite', relation: 'liaison' });
  assert.equal(trB.voie, 'composition');
});

test('A action -> A rejeu (VRAI) -> B : B pointe vers la trace ACTION, jamais vers la trace rejeu', async () => {
  const { ecran, magasin, e } = await monter();
  const rA = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');

  // Corpus « unique » du rejeu (même schéma que tests/rejeu-autonome.test.mjs, capacité deduction).
  let n = 1000;
  const faux = (texteBrut) => {
    n += 1;
    return {
      id: n, sequence: n, horodatage: '2000-01-01T00:00:00.000Z', capacite: 'deduction', voie: 'action',
      argumentsUtilises: {}, provenanceArguments: {}, resultat: { peuImporte: true },
      contexte: { texteBrut, tokens: [] }, provenancePositions: { sujet: 1, role: 3 },
    };
  };
  e.traces.push(faux('zaccede zsA zordre zvalA'), faux('zaccede zsB zordre zvalA'));

  const mapAvant = e.derniersResultats.get('deduction');
  const origineAvant = e.originesResultats.get('deduction');
  const rejeu = await ecran.tenterRejeuAutonome('zaccede zsNEW zordre zvalA');
  assert.equal(rejeu.reconnu, true, 'précondition : un VRAI rejeu a eu lieu');
  const trRejeu = await traceDe(magasin, rejeu.idTrace);
  assert.equal(trRejeu.voie, 'rejeu');
  assert.equal(trRejeu.capacite, 'deduction');
  assert.equal(trRejeu.provenanceLiaisons, null, 'trace rejeu : provenanceLiaisons = null');

  // REJEU STRICTEMENT INCHANGÉ : n'alimente ni derniersResultats, ni originesResultats.
  assert.equal(e.derniersResultats.get('deduction'), mapAvant, 'même référence : le rejeu ne touche pas derniersResultats');
  assert.equal(e.originesResultats.get('deduction'), origineAvant, 'même entrée : le rejeu ne touche pas originesResultats');

  const b = await composerB(ecran);
  const trB = await traceDe(magasin, b.idTrace);
  assert.equal(trB.provenanceLiaisons.relation.idTraceSource, rA.idTrace, 'la trace ACTION');
  assert.notEqual(trB.provenanceLiaisons.relation.idTraceSource, rejeu.idTrace);
  assert.equal(trB.argumentsUtilises.relation, 'zcouleur', 'valeur du résultat ACTION (celui que le Map détient encore)');
});

test('PANNE de la trace A2 après A1 : B consomme toujours le résultat A2 (comme aujourd\'hui), idTraceSource = null, JAMAIS A1', async () => {
  const { ecran, magasin, e } = await monter();
  const r1 = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1'); // -> zcouleur
  assert.equal(e.derniersResultats.get('deduction').resultat, 'zcouleur');
  const nbTraces = (await magasin.lireTout('traces')).length;

  magasin.etat.panne = true;
  await assert.rejects(() => ecran.tenterReconnaissanceAction('zdeduit zorbo zrole2'), /PANNE traces/); // A2 -> ztaille
  magasin.etat.panne = false;
  assert.equal((await magasin.lireTout('traces')).length, nbTraces, 'aucune trace A2');
  // Comportement ACTUEL inchangé : le résultat A2 est bien celui du Map (écrit avant la trace).
  assert.equal(e.derniersResultats.get('deduction').resultat, 'ztaille');

  const b = await composerB(ecran);
  assert.equal(b.ok, true);
  const trB = await traceDe(magasin, b.idTrace);
  assert.equal(trB.argumentsUtilises.relation, 'ztaille', 'B consomme le résultat A2, comme avant ce chantier');
  assert.equal(trB.provenanceLiaisons.relation.idTraceSource, null);
  assert.notEqual(trB.provenanceLiaisons.relation.idTraceSource, r1.idTrace);
  assert.equal(trB.provenanceLiaisons.relation.idLiaison, e.liaisons[0].id, 'la liaison reste connue');
});

test('DEUX rôles liés à DEUX sources (action + composition) : deux provenances exactes et distinctes', async () => {
  const { ecran, magasin, e } = await monter();
  await ecran.confirmerLiaison({
    capaciteSource: 'accessibilite', champ: 'etat', capaciteCible: 'confrontation', role: 'sujetB',
  });
  const rA = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1'); // source ACTION
  const rAcc = await ecran.invoquerComposition({ // source COMPOSITION
    operation: 'accessibilite', argumentsExplicites: { sujetA: 'zorbo', operateur: 'zcouleur', sujetB: 'zkelmi' },
  });
  assert.equal(rAcc.ok, true);
  const b = await ecran.invoquerComposition({ operation: 'confrontation', argumentsExplicites: { sujetA: 'zorbo' } });
  assert.equal(b.ok, true);
  const trB = await traceDe(magasin, b.idTrace);
  const [l1, l2] = e.liaisons;
  assert.deepEqual(trB.provenanceLiaisons, {
    relation: { idTraceSource: rA.idTrace, idLiaison: l1.id },
    sujetB: { idTraceSource: rAcc.idTrace, idLiaison: l2.id },
  });
  assert.notEqual(l1.id, l2.id);
  assert.deepEqual(trB.provenanceArguments, { sujetA: 'explicite', sujetB: 'liaison', relation: 'liaison' });
});

test('TOUT explicite : provenanceLiaisons = null (retour ET trace persistée, champ présent)', async () => {
  const { ecran, magasin } = await monter();
  await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  const b = await composerB(ecran, { relation: 'zcouleur' });
  assert.equal(b.ok, true);
  const trB = await traceDe(magasin, b.idTrace);
  assert.equal(Object.prototype.hasOwnProperty.call(trB, 'provenanceLiaisons'), true);
  assert.equal(trB.provenanceLiaisons, null);
  assert.deepEqual(trB.provenanceArguments, { sujetA: 'explicite', sujetB: 'explicite', relation: 'explicite' });
});

test('trace ACTION : provenanceLiaisons = null (champ présent)', async () => {
  const { ecran, magasin } = await monter();
  const r = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  const tr = await traceDe(magasin, r.idTrace);
  assert.equal(Object.prototype.hasOwnProperty.call(tr, 'provenanceLiaisons'), true);
  assert.equal(tr.provenanceLiaisons, null);
});

test('DEUX liaisons candidates : le `.find` est inchangé ; la provenance désigne la liaison RÉELLEMENT choisie', async () => {
  const { ecran, magasin, e } = await monter();
  await ecran.confirmerLiaison({
    capaciteSource: 'accessibilite', champ: 'etat', capaciteCible: 'confrontation', role: 'relation',
  });
  const [l1, l2] = e.liaisons;
  assert.equal(l1.capaciteSource, 'deduction');
  assert.equal(l2.capaciteSource, 'accessibilite');
  const rA = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  const rAcc = await ecran.invoquerComposition({
    operation: 'accessibilite', argumentsExplicites: { sujetA: 'zorbo', operateur: 'zcouleur', sujetB: 'zkelmi' },
  });

  const b = await composerB(ecran);
  const trB = await traceDe(magasin, b.idTrace);
  assert.equal(trB.argumentsUtilises.relation, 'zcouleur', 'comportement actuel : la PREMIÈRE liaison est prise');
  assert.deepEqual(trB.provenanceLiaisons.relation, { idTraceSource: rA.idTrace, idLiaison: l1.id });

  // Même tableau inversé : le `.find` prend l'autre, et la provenance suit CE choix-là, rien d'autre.
  e.liaisons = [...e.liaisons].reverse();
  const b2 = await composerB(ecran);
  const trB2 = await traceDe(magasin, b2.idTrace);
  assert.equal(trB2.argumentsUtilises.relation, 'inaccessible');
  assert.deepEqual(trB2.provenanceLiaisons.relation, { idTraceSource: rAcc.idTrace, idLiaison: l2.id });

  // Aucune information sur les alternatives n'est ajoutée à la provenance.
  assert.deepEqual(Object.keys(trB.provenanceLiaisons.relation).sort(), ['idLiaison', 'idTraceSource']);
});

test('A -> B -> C : C pointe vers la trace de B (une composition peut devenir source)', async () => {
  const { ecran, magasin, e } = await monter();
  await ecran.confirmerLiaison({
    capaciteSource: 'confrontation', champ: 'etat', capaciteCible: 'recherche', role: 'valeur',
  });
  const [l1, l2] = e.liaisons;
  const rA = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  const b = await composerB(ecran);
  assert.equal(b.ok, true);
  const trB = await traceDe(magasin, b.idTrace);
  assert.deepEqual(trB.provenanceLiaisons.relation, { idTraceSource: rA.idTrace, idLiaison: l1.id });

  const c = await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur' } });
  assert.equal(c.ok, true);
  const trC = await traceDe(magasin, c.idTrace);
  assert.deepEqual(trC.provenanceLiaisons, { valeur: { idTraceSource: b.idTrace, idLiaison: l2.id } });
  assert.equal(trC.argumentsUtilises.valeur, 'egal');
});

test('PANNE de la trace B : exception propagée, aucune provenance fabriquée, Map[B] écrit sans origine (comportement inchangé)', async () => {
  const { ecran, magasin, e } = await monter();
  await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  const nbTraces = (await magasin.lireTout('traces')).length;
  magasin.etat.panne = true;
  await assert.rejects(() => composerB(ecran), /PANNE traces/);
  magasin.etat.panne = false;
  assert.equal((await magasin.lireTout('traces')).length, nbTraces, 'aucune trace B');
  assert.equal(e.derniersResultats.has('confrontation'), true, 'comportement actuel : Map[B] déjà écrit');
  assert.equal(e.originesResultats.has('confrontation'), false, 'mais aucune origine inventée pour B');
});

// ============================================================================ UNITAIRE : noterOrigineResultat
test('noterOrigineResultat : écrit seulement si la RÉFÉRENCE est celle de derniersResultats ET si idTrace est une chaîne non vide', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  const r = { etat: 'egal' };
  assert.equal(noterOrigineResultat(esprit, 'confrontation', r, 'trace-1'), false, 'rien dans derniersResultats');
  assert.equal(esprit.originesResultats, undefined);
  enregistrerResultat(esprit, 'confrontation', r);
  assert.equal(noterOrigineResultat(esprit, 'confrontation', { etat: 'egal' }, 'trace-1'), false, 'même contenu, AUTRE référence');
  for (const mauvais of ['', undefined, null, 7, {}, ['trace-1']]) {
    assert.equal(noterOrigineResultat(esprit, 'confrontation', r, mauvais), false, `idTrace ${String(mauvais)}`);
  }
  assert.equal(esprit.originesResultats, undefined, 'aucune écriture tant qu\'aucune condition n\'est remplie');
  assert.equal(noterOrigineResultat(esprit, 'confrontation', r, 'trace-1'), true);
  assert.deepEqual(esprit.originesResultats.get('confrontation'), { resultat: r, idTrace: 'trace-1' });
  assert.equal(esprit.originesResultats.get('confrontation').resultat, r, 'référence conservée');
});

test('noterOrigineResultat : une trace TARDIVE (plus celle du résultat courant) n\'écrase jamais une origine plus récente', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  const a1 = { etat: 'egal' };
  const a2 = { etat: 'egal' };
  enregistrerResultat(esprit, 'confrontation', a1);
  enregistrerResultat(esprit, 'confrontation', a2);
  assert.equal(noterOrigineResultat(esprit, 'confrontation', a2, 'trace-A2'), true);
  assert.equal(noterOrigineResultat(esprit, 'confrontation', a1, 'trace-A1'), false, 'A1 n\'est plus le résultat courant');
  assert.equal(esprit.originesResultats.get('confrontation').idTrace, 'trace-A2');
});

// ============================================================================ UNITAIRE : lecture dans invoquerAvecLiaisons
const liaisonMain = (extra = {}) => ({ ...L_DEDUCTION_RELATION, statut: 'validee', ...extra });

test('liaison SANS id (construite à la main en test) : idLiaison = null, jamais reconstruit', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  esprit.liaisons = [liaisonMain()];
  const r = { resultat: 'zcouleur' };
  enregistrerResultat(esprit, 'deduction', r);
  noterOrigineResultat(esprit, 'deduction', r, 'trace-A');
  const inv = invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', sujetB: 'y' } });
  assert.equal(inv.ok, true);
  assert.deepEqual(inv.provenanceLiaisons, { relation: { idTraceSource: 'trace-A', idLiaison: null } });
  for (const id of ['', undefined, null, 7]) {
    esprit.liaisons = [liaisonMain({ id })];
    const i2 = invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', sujetB: 'y' } });
    assert.equal(i2.provenanceLiaisons.relation.idLiaison, null, `id ${String(id)}`);
  }
  esprit.liaisons = [liaisonMain({ id: 'liaison-9' })];
  const i3 = invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', sujetB: 'y' } });
  assert.equal(i3.provenanceLiaisons.relation.idLiaison, 'liaison-9');
});

test('origine ANCIENNE (référence différente de celle du Map) : IGNORÉE -> idTraceSource = null, jamais l\'ancienne trace', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  esprit.liaisons = [liaisonMain({ id: 'L' })];
  const a1 = { resultat: 'zcouleur' };
  const a2 = { resultat: 'zcouleur' }; // même contenu, autre exécution
  enregistrerResultat(esprit, 'deduction', a1);
  noterOrigineResultat(esprit, 'deduction', a1, 'trace-A1');
  enregistrerResultat(esprit, 'deduction', a2); // sa trace n'a jamais été notée (panne)
  const inv = invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', sujetB: 'y' } });
  assert.deepEqual(inv.provenanceLiaisons, { relation: { idTraceSource: null, idLiaison: 'L' } });
});

test('résultat conservé SANS aucune origine (enregistrerResultat direct) : idTraceSource = null', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  esprit.liaisons = [liaisonMain({ id: 'L' })];
  enregistrerResultat(esprit, 'deduction', { resultat: 'zcouleur' });
  const inv = invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', sujetB: 'y' } });
  assert.deepEqual(inv.provenanceLiaisons, { relation: { idTraceSource: null, idLiaison: 'L' } });
});

test('liaison dont la source est la capacité INVOQUÉE elle-même : l\'origine est lue AVANT que le résultat soit réécrit', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  esprit.liaisons = [{
    statut: 'validee', id: 'LB', capaciteSource: 'confrontation', champ: 'etat', capaciteCible: 'confrontation', role: 'relation',
  }];
  const premier = { etat: 'egal' };
  enregistrerResultat(esprit, 'confrontation', premier);
  noterOrigineResultat(esprit, 'confrontation', premier, 'trace-B1');
  const inv = invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', sujetB: 'y' } });
  assert.deepEqual(inv.provenanceLiaisons, { relation: { idTraceSource: 'trace-B1', idLiaison: 'LB' } });
  assert.notEqual(esprit.derniersResultats.get('confrontation'), premier, 'le Map a bien été réécrit après la lecture');
});

// ============================================================================ NON-RÉGRESSIONS
test('derniersResultats : forme BRUTE Map<capacité, résultat> inchangée (aucun idTrace dedans)', async () => {
  const { ecran, magasin, e } = await monter();
  const r = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  const brut = e.derniersResultats.get('deduction');
  assert.equal(brut.resultat, 'zcouleur', 'le champ `resultat` de la capacité, pas une enveloppe');
  assert.equal(Object.prototype.hasOwnProperty.call(brut, 'idTrace'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(brut)), (await traceDe(magasin, r.idTrace)).resultat);
  assert.deepEqual([...e.derniersResultats.keys()], ['deduction']);
  assert.equal(e.originesResultats.get('deduction').resultat, brut, 'l\'origine référence CE MÊME objet');
  assert.equal(e.originesResultats.get('deduction').idTrace, r.idTrace);
});

test('abstentions inchangées : mêmes refus, aucune clé provenanceLiaisons, aucune origine écrite', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  esprit.liaisons = [];
  assert.deepEqual(invoquerAvecLiaisons(esprit, { operation: 'zinconnue' }), { ok: false, raison: 'operation_inconnue' });
  assert.deepEqual(
    invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', sujetB: 'y' } }),
    { ok: false, raison: 'role_non_resolu', detail: { role: 'relation', raison: 'aucune_liaison' } },
  );
  esprit.liaisons = [liaisonMain({ id: 'L' })];
  assert.deepEqual(
    invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', sujetB: 'y' } }),
    { ok: false, raison: 'role_non_resolu', detail: { role: 'relation', raison: 'aucun_resultat' } },
    'le détail d\'abstention n\'est pas modifié',
  );
  assert.equal(esprit.originesResultats, undefined);
  assert.equal(esprit.derniersResultats, undefined);
});

test('retour d\'une invocation réussie : les clés d\'origine sont conservées, provenanceLiaisons est la SEULE ajoutée', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  const inv = invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'x', relation: 'r', sujetB: 'y' } });
  assert.deepEqual(Object.keys(inv).sort(), ['arguments', 'ok', 'provenanceArguments', 'provenanceLiaisons', 'resultat']);
  assert.deepEqual(inv.provenanceArguments, { sujetA: 'explicite', sujetB: 'explicite', relation: 'explicite' });
  assert.equal(inv.provenanceLiaisons, null);
});

test('valeurLiee : inchangée (renvoie toujours la liaison choisie, première correspondance)', async () => {
  const esprit = await chargerEsprit(magasinMemoireVive());
  esprit.liaisons = [liaisonMain({ id: 'L1' }), { ...liaisonMain({ id: 'L2' }), capaciteSource: 'accessibilite', champ: 'etat' }];
  enregistrerResultat(esprit, 'deduction', { resultat: 'zcouleur' });
  enregistrerResultat(esprit, 'accessibilite', { etat: 'accessible' });
  const v = valeurLiee(esprit, { capaciteCible: 'confrontation', role: 'relation' });
  assert.equal(v.ok, true);
  assert.equal(v.valeur, 'zcouleur');
  assert.equal(v.liaison.id, 'L1');
  // Pas de repli sur la 2e liaison quand la 1re n'a aucun résultat (dette séparée, NON corrigée ici).
  esprit.derniersResultats.delete('deduction');
  assert.deepEqual(valeurLiee(esprit, { capaciteCible: 'confrontation', role: 'relation' }).raison, 'aucun_resultat');
});

test('enregistrerTrace : provenanceLiaisons par défaut null ; copie profonde ; undefined -> null ; provenanceArguments intact', async () => {
  const magasin = magasinMemoireVive();
  const base = {
    capacite: 'confrontation', voie: 'composition', argumentsUtilises: { a: 1 }, provenanceArguments: { a: 'liaison' }, resultat: { etat: 'egal' },
  };
  const t0 = await enregistrerTrace(magasin, base);
  assert.equal(t0.provenanceLiaisons, null);
  const t1 = await enregistrerTrace(magasin, { ...base, provenanceLiaisons: undefined });
  assert.equal(t1.provenanceLiaisons, null);
  const fourni = { a: { idTraceSource: 'trace-x', idLiaison: 'liaison-y' } };
  const t2 = await enregistrerTrace(magasin, { ...base, provenanceLiaisons: fourni });
  assert.deepEqual(t2.provenanceLiaisons, fourni);
  fourni.a.idTraceSource = 'MUTÉ';
  assert.equal(t2.provenanceLiaisons.a.idTraceSource, 'trace-x', 'copie, pas référence');
  assert.deepEqual(t2.provenanceArguments, { a: 'liaison' });
});

test('LIMITE DOCUMENTÉE (NON corrigée ici) : une valeur NaN devient null dans la copie JSON de la trace ; la provenance, elle, reste exacte', async () => {
  const magasin = magasinMemoireVive();
  const t = await enregistrerTrace(magasin, {
    capacite: 'confrontation', voie: 'composition', argumentsUtilises: { x: Number.NaN }, provenanceArguments: { x: 'liaison' },
    resultat: { etat: 'egal' }, provenanceLiaisons: { x: { idTraceSource: 'trace-s', idLiaison: 'liaison-l' } },
  });
  assert.equal(t.argumentsUtilises.x, null);
  assert.deepEqual(t.provenanceLiaisons, { x: { idTraceSource: 'trace-s', idLiaison: 'liaison-l' } });
});

test('originesResultats : NON persistée, NON exportée, NON reconstruite au démarrage', async () => {
  const { ecran, magasin, e } = await monter();
  await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  await composerB(ecran);
  assert.equal(e.originesResultats instanceof Map, true);
  assert.equal(TABLES.some((t) => /origine/i.test(t)), false, 'aucune table dédiée');
  const tout = {};
  for (const t of TABLES) tout[t] = await magasin.lireTout(t);
  assert.equal(JSON.stringify(tout).includes('originesResultats'), false, 'rien dans ce qui serait exporté');
  const neuf = await chargerEsprit(magasin);
  assert.equal(neuf.originesResultats, undefined, 'aucune reconstruction au chargement');
  assert.equal(neuf.derniersResultats, undefined);
});

// ============================================================================ STATIQUE : AUCUN CONSOMMATEUR
const RACINE = new URL('..', import.meta.url).pathname;
function fichiersJs(dossier) {
  const sortie = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiersJs(chemin));
    else if (nom.endsWith('.js')) sortie.push(chemin);
  }
  return sortie;
}
const sansCommentaires = (src) => src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

test('STATIQUE : seuls composition.js (écrit), connaissances.js (persiste) et ecran.js (transmet) connaissent la provenance', () => {
  const autorises = new Set(['app/langage/composition.js', 'app/langage/connaissances.js', 'app/langage/ecran.js']);
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const rel = relative(RACINE, f);
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    const touche = /provenanceLiaisons|originesResultats|noterOrigineResultat|idTraceSource/.test(code);
    if (autorises.has(rel)) continue;
    assert.equal(touche, false, `${rel} ne doit jamais lire ni écrire la provenance des liaisons`);
  }
});

test('STATIQUE : le rejeu et la voie action ne manipulent ni provenanceLiaisons, ni ne deviennent source', () => {
  const src = readFileSync(join(RACINE, 'app/langage/ecran.js'), 'utf8');
  const debutRejeu = src.indexOf('async function tenterRejeuAutonome');
  const finRejeu = src.indexOf('// === LIAISONS APPRISES (v0.43.0');
  assert.ok(debutRejeu > 0 && finRejeu > debutRejeu);
  const rejeu = sansCommentaires(src.slice(debutRejeu, finRejeu));
  assert.equal(/enregistrerResultat\(|noterOrigineResultat\(|provenanceLiaisons|originesResultats/.test(rejeu), false, 'le rejeu n\'alimente rien');
  const debutAction = src.indexOf('async function tenterReconnaissanceAction');
  const finAction = src.indexOf('// === PREMIER REJEU AUTONOME');
  const action = sansCommentaires(src.slice(debutAction, finAction));
  assert.equal(/provenanceLiaisons/.test(action), false, 'la voie action ne passe aucune provenance de liaison');
  assert.equal((action.match(/noterOrigineResultat\(/g) || []).length, 1);
  const code = sansCommentaires(src);
  assert.equal((code.match(/noterOrigineResultat\(/g) || []).length, 2, 'exactement deux points d\'appel : action et composition');
  const lignesProvenance = code.split('\n').filter((l) => /provenanceLiaisons/.test(l));
  assert.equal(lignesProvenance.length, 1, 'une seule transmission, dans invoquerComposition');
  assert.match(lignesProvenance[0], /provenanceLiaisons: invocation\.provenanceLiaisons,/);
  // L'ordre actuel est conservé : enregistrerResultat AVANT enregistrerTrace, puis noter APRÈS.
  const iResultat = action.indexOf('enregistrerResultat(');
  const iTrace = action.indexOf('await enregistrerTrace(');
  const iNoter = action.indexOf('noterOrigineResultat(');
  assert.ok(iResultat >= 0 && iResultat < iTrace && iTrace < iNoter, 'enregistrerResultat -> enregistrerTrace -> noterOrigineResultat');
});

test('STATIQUE : le `.find` de valeurLiee est textuellement inchangé', () => {
  const src = readFileSync(join(RACINE, 'app/langage/composition.js'), 'utf8');
  assert.ok(src.includes('const liaison = (esprit.liaisons || []).find((l) => l.statut === \'validee\'\n    && l.capaciteCible === capaciteCible && l.role === role);'));
});
// === FIN_TEST_PROVENANCE_LIAISONS ===
