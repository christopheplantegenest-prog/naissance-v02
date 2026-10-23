// v0.65.23 — R1 « RÉGULARISATION SUR PREUVE FINALE » : compatibilité de restauration et de sauvegarde avec v0.65.22 (GO 23/10/2026,
// exigence « compatibilité de restauration/sauvegarde avec v0.65.22 »). OUTILLAGE NON COGNITIF.
// La régularisation n'ajoute AUCUN format : un événement « tentative-annulee » et un « cout » déjà admis par chantier.js et budget.js
// v0.65.22, avec des champs supplémentaires conservés tels quels. Les modules qui lisent, écrivent, découpent et restaurent l'état durable
// sont ceux de v0.65.22, octet pour octet (empreintes git des blobs de main 9f386c41) ; l'état régularisé R1 fait l'aller-retour complet
// (parties k/N, restauration, nouvelle écriture) sans perte ; un état sans régularisation est inchangé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { appliquer, verifierJournal } from '../app/atelier/chantier.js';
import { appliquerBudget, verifierRegistre, etatBudget } from '../app/atelier/budget.js';
import { lireEtatDurable, ecrireEtatDurable, canonique, decouper, preparerRestauration } from '../app/atelier/journal.js';
import { decisionRegularisation } from '../app/atelier/retour.js';
import { CH, T, CHANTIER, J3, D3, V2, preuveLue, autorisationLue } from './atelier-regularisation-aide.mjs';

// Empreintes git (SHA-1 de « blob <octets>\0<contenu> ») des modules de l'état durable à v0.65.22 (main 9f386c41).
// MISE À JOUR DÉLIBÉRÉE exigée si l'un d'eux change : la compatibilité avec v0.65.22 devra alors être redémontrée.
const V0_65_22 = Object.freeze({
  'chantier.js': '3bfd9d005a6e5dc3cc01cf88d195ce27b4b0cfc3',
  'budget.js': '9aa8b0794193a08990db165a3f94c3e31401a21d',
  'journal.js': '276056080e569c7dbc28cbcdafd35c8a10618f9e',
  'carnet.js': '55aabcaef3963aa287f3c9e80e9f8fc12858228f',
  'auto.js': '3038c1e55685d28d08795c387fd1ca7d74c4777f',
  'empreinte.js': 'f423bc14ad0bfc9228007b968ce0594c7c2877af',
  'parcours.js': '0a9282517d88aecf93308deb80c7ce867f10d05e',
});
const blobGit = (b) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');

// État régularisé produit exactement comme regulariserPreuve (ecran.js) : une annulation + un coût 0 « preuve-finale ».
function regularise() {
  const r1 = lireEtatDurable(CHANTIER).durable;
  const P = preuveLue();
  const d = decisionRegularisation({ preuve: P, autorisation: autorisationLue({ preuve: P }), t: T, d3: D3, vivante: true, engagement: 'engagee', carnet: false, deja: {}, decideur: V2.login, montant: '0', motif: 'm' });
  assert.equal(d.raison, undefined);
  const quand = '2026-10-23T09:15:00.000Z';
  const journal = appliquer(r1.journal, { type: 'tentative-annulee', quand, donnees: { jalon: 'blanc-1', numero: 1, motif: 'm', mode: 'AUTO', issue: 'issue-inconnue', faits_auto: d.faits_auto, faits_auto_empreinte: d.faits_auto_empreinte, regularisation: structuredClone(d.regularisation) } });
  const registre = appliquerBudget(r1.registre, { type: 'cout', quand, donnees: { execution: T, montant: 0, issue: 'issue-inconnue', regularisation: 'preuve-finale' } });
  assert.ok(Array.isArray(journal) && Array.isArray(registre));
  return { journal, registre, pieces: r1.pieces, piecesDepuis: r1.piecesDepuis, regularisation: d.regularisation };
}

test('modules de l\'état durable identiques à v0.65.22 (empreintes git des blobs)', () => {
  for (const [f, sha] of Object.entries(V0_65_22)) assert.equal(blobGit(readFileSync(new URL(`../app/atelier/${f}`, import.meta.url))), sha, f);
});

test('état R1 sans régularisation : relu et réécrit à l\'identique (chantier.json réel, empreinte aaeaa362)', () => {
  const l = lireEtatDurable(CHANTIER);
  assert.equal(l.raison, undefined);
  assert.equal(l.empreinte, D3.empreinte);
  assert.equal(ecrireEtatDurable(l.durable).texte, CHANTIER);
});

test('état régularisé : vérifié, relu octet pour octet, parties k/N, restauration, nouvelle écriture identique ; champs B conservés', () => {
  const c = regularise();
  assert.deepEqual(verifierJournal(c.journal), { ok: true });
  assert.equal(verifierRegistre(c.registre).ok, true);
  const { texte, empreinte } = ecrireEtatDurable(c);
  const l = lireEtatDurable(texte);
  assert.equal(l.raison, undefined);
  assert.equal(canonique(l.durable), texte);
  const parties = decouper(texte, CH);
  for (const ordre of [parties, [...parties].reverse()]) {
    const r = preparerRestauration(ordre);
    assert.equal(r.statut, 'pret', r.raison);
    assert.equal(r.empreinte, empreinte);
    assert.equal(ecrireEtatDurable(structuredClone(r.lu.durable)).texte, texte, 'restauration puis sauvegarde : même texte');
  }
  const ev = l.durable.journal.at(-1);
  assert.equal(ev.donnees.faits_auto, J3, 'J3 historique intact');
  assert.equal(ev.donnees.issue, 'issue-inconnue');
  assert.equal(JSON.stringify(ev.donnees.regularisation), JSON.stringify(JSON.parse(canonique(c.regularisation))), 'enregistrement B intégral (clés triées)');
  assert.deepEqual(l.durable.registre.at(-1).donnees, { execution: T, issue: 'issue-inconnue', montant: 0, regularisation: 'preuve-finale' });
  assert.equal(etatBudget(l.durable.registre).executions[T].statut, 'payee');
});
