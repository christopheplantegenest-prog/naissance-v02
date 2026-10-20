// v0.65.14 — AT-9 jalon 2 : numéro du passage AT-5 dans l'Atelier. OUTILLAGE NON COGNITIF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { monterEcran, confirmerSauvegarde, BASE, RAPPORT_POUR, FAITS, VERSION_BASE } from './atelier-aide.mjs';

async function parcours(run) {
  const a = monterEcran({ version: VERSION_BASE });
  await a.cliquer('mode-manuel');
  await a.cliquer('temoin');
  a.saisir('sha', BASE);
  await a.cliquer('ouvrir');
  await a.cliquer('approuver');
  await a.cliquer('generer');
  await a.cliquer('lancer');
  await confirmerSauvegarde(a);
  const k = Object.keys(a.copie().pieces).at(-1);
  a.saisir('rapport', RAPPORT_POUR(a.copie().pieces[k].mission));
  await a.cliquer('enregistrer');
  await a.cliquer('copier-demande');
  a.saisir('faits-colles', FAITS({ demande: a.copie().pieces[k].demande, run }));
  await a.cliquer('confronter');
  const verdictRun = a.un('verdict-run').textContent;
  a.saisir('motif-decision', 'Décision témoin.');
  await a.cliquer('accepter');
  const accepte = a.trouver('accepte-temoin-1');
  return { verdictRun, accepte };
}

for (const run of ['41000000001', '42999999977']) {
  test(`passage AT-5 ${run} : cadre du verdict puis ligne du candidat accepté`, async () => {
    const { verdictRun, accepte } = await parcours(run);
    assert.equal(verdictRun, `Passage AT-5 : ${run}`);
    assert.equal(accepte.length, 1);
    assert.ok(accepte[0].textContent.endsWith(`— passage AT-5 ${run}`), accepte[0].textContent);
    assert.ok(accepte[0].textContent.includes('candidat accepté'));
  });
}
