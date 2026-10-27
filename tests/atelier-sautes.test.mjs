// GO « ATELIER 3 — CORRECTION D1 » (27/10/2026) : tests SAUTÉS à la fin d'un développement de l'Atelier (outillage non cognitif).
// Défaut réel du ticket 31 : dans le bac de l'agent (docker sans réseau, sans Playwright), 5 épreuves navigateur étaient SAUTÉES
// (5966 tests, 5961 réussis, 0 échec) ; l'outil « terminer » exigeait réussis = total : l'agent ne pouvait jamais finir.
// Règle : fin admise si aucun échec, réussis + sautés = total, et chaque saut (nom ET motif) existe déjà sur la BASE jouée dans le même
// bac, figée avant tout travail de l'agent. Un saut n'est jamais compté comme réussi ; aucun saut nouveau, changé ou en plus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outilsEtape, raisonSautes, sautesTap, resumeTap } from '../outils-atelier/auto-agent.mjs';

const MOTIF = 'Playwright absent de cet environnement (le robot joue le scénario dans son job « acceptation »)';
const NAV = ['JOUEUR NAVIGATEUR (Chromium réel) : vert sur le candidat', 'JOUEUR NAVIGATEUR sur la VRAIE application', 'BOUT EN BOUT : « Atelier : bouton Saluer »', 'CONTRE-ÉPREUVES de bout en bout', 'MAIN AVANCÉE pendant le chantier'];
// Sortie TAP du bac : n réussis, puis les sauts donnés [nom, motif], puis le résumé de node --test.
function tap({ reussis, sauts = [], echecs = 0, todo = 0 }) {
  const l = [];
  let i = 0;
  for (let k = 0; k < reussis; k += 1) l.push(`ok ${++i} - garde ${k}`);
  for (const [nom, motif] of sauts) l.push(`ok ${++i} - ${nom} # SKIP${motif ? ` ${motif}` : ''}`);
  for (let k = 0; k < echecs; k += 1) l.push(`not ok ${++i} - cassé ${k}`);
  for (let k = 0; k < todo; k += 1) l.push(`ok ${++i} - à faire ${k} # TODO`);
  l.push(`# tests ${i}`, `# pass ${reussis}`, `# fail ${echecs}`, '# cancelled 0', `# skipped ${sauts.length}`, `# todo ${todo}`);
  const sortie = `${l.join('\n')}\n`;
  return { code: echecs ? 1 : 0, resume: resumeTap(sortie), sortie };
}
const SAUTS_31 = NAV.map((n) => [n, MOTIF]);
const TICKET_31 = () => tap({ reussis: 5961, sauts: SAUTS_31 });

function avecOutils(suites, base, f) {
  const d = mkdtempSync(join(tmpdir(), 'sautes-'));
  mkdirSync(join(d, 'app'), { recursive: true });
  writeFileSync(join(d, 'app', 'a.js'), 'export const a = 1;\n');
  let appelsBase = 0;
  const o = outilsEtape({ etape: 'developper', racine: d, autorises: ['app/a.js'], suiteComplete: () => suites.shift(), suiteBase: () => { appelsBase += 1; return base; } });
  return Promise.resolve(f((n, e) => o.executer(n, e), () => appelsBase)).finally(() => rmSync(d, { recursive: true, force: true }));
}

test('TICKET 31 reproduit : 5966 tests, 5961 réussis, 5 sautés déjà sautés sur la base -> la fin est ADMISE (avant : refus sans issue)', async () => {
  const s = TICKET_31();
  assert.deepEqual(s.resume, { total: 5966, reussis: 5961, echecs: 0, sautes: 5 });
  assert.notEqual(s.resume.reussis, s.resume.total, 'l\'ancienne règle « réussis = total » refusait ce candidat');
  assert.equal(raisonSautes(s, tap({ reussis: 5950, sauts: SAUTS_31 })), null);
  await avecOutils([TICKET_31()], tap({ reussis: 5950, sauts: SAUTS_31 }), async (x, appels) => {
    const r = await x('terminer', { statut: 'candidat', resume: 'bouton Saluer' });
    assert.deepEqual(r.fin.tests, { total: 5966, reussis: 5961, echecs: 0, sautes: 5 }, 'les sautés restent comptés à part, jamais comme réussis');
    assert.deepEqual(r.fin.sautes, NAV.map((n) => `0:${n} # ${MOTIF}`));
    assert.equal(appels(), 1);
  });
});

test('REFUS : un saut NOUVEAU, un motif CHANGÉ, ou un saut de PLUS que la base', async () => {
  const base = tap({ reussis: 10, sauts: SAUTS_31 });
  assert.match(raisonSautes(tap({ reussis: 9, sauts: [...SAUTS_31, ['garde ajoutée', 'pas le temps']] }), base), /nouveau saut interdit[^]*garde ajoutée # pas le temps/);
  assert.match(raisonSautes(tap({ reussis: 10, sauts: SAUTS_31.map(([n], i) => [n, i ? MOTIF : 'autre motif']) }), base), /nouveau saut interdit[^]*autre motif/);
  assert.match(raisonSautes(tap({ reussis: 9, sauts: [...SAUTS_31, SAUTS_31[0]] }), base), /nouveau saut interdit/, 'multiensemble : un même saut une fois de trop');
  assert.match(raisonSautes(tap({ reussis: 9, sauts: [['sans motif', '']] }), tap({ reussis: 10 })), /nouveau saut interdit[^]*sans motif/);
});

test('REFUS : un contrôle obligatoire NON EXÉCUTÉ (réussi sur la base, sauté dans le candidat), un todo, des comptes incohérents, une base absente', async () => {
  // La base exécute « garde 3 » ; le candidat la saute : contrôle obligatoire non exécuté.
  assert.match(raisonSautes(tap({ reussis: 9, sauts: [...SAUTS_31, ['garde 3', MOTIF]] }), tap({ reussis: 10, sauts: SAUTS_31 })), /nouveau saut interdit[^]*garde 3/);
  assert.match(raisonSautes(tap({ reussis: 9, sauts: SAUTS_31, todo: 1 }), tap({ reussis: 9, sauts: SAUTS_31 })), /comptes incohérents/);
  const faux = TICKET_31();
  faux.sortie = faux.sortie.replace(/^ok \d+ - MAIN AVANCÉE.*$/m, 'ok 5966 - MAIN AVANCÉE pendant le chantier');
  assert.match(raisonSautes(faux, tap({ reussis: 9, sauts: SAUTS_31 })), /sauts non identifiés \(4 lus pour 5 annoncés\)/);
  assert.match(raisonSautes(TICKET_31(), { code: 'delai', resume: null, sortie: '' }), /base indisponible/);
  assert.match(raisonSautes(TICKET_31(), null), /base indisponible/);
});

test('TERMINER : un échec n\'est jamais racheté par la règle des sauts ; refus répétés -> échec ; base jouée seulement s\'il y a des sauts', async () => {
  await avecOutils([tap({ reussis: 3, sauts: SAUTS_31, echecs: 1 }), tap({ reussis: 4 })], tap({ reussis: 3, sauts: SAUTS_31 }), async (x, appels) => {
    assert.match((await x('terminer', { statut: 'candidat', resume: 'r' })).erreur, /suite complète en échec \(1 échec\(s\)/);
    assert.equal(appels(), 0, 'avec un échec, la base n\'est même pas consultée');
    assert.deepEqual((await x('terminer', { statut: 'candidat', resume: 'r' })).fin.tests, { total: 4, reussis: 4, echecs: 0, sautes: 0 });
    assert.equal(appels(), 0, 'sans saut, la base n\'est pas jouée');
  });
  const nouveau = () => tap({ reussis: 9, sauts: [...SAUTS_31, ['ma garde', 'plus tard']] });
  await avecOutils([nouveau(), nouveau(), nouveau(), nouveau()], tap({ reussis: 10, sauts: SAUTS_31 }), async (x, appels) => {
    for (let k = 0; k < 3; k += 1) assert.match((await x('terminer', { statut: 'candidat', resume: 'r' })).erreur, /suite complète refusée \(tests 15, réussis 9, sautés 6, échecs 0\) : nouveau saut interdit/);
    const f = (await x('terminer', { statut: 'candidat', resume: 'r' })).fin;
    assert.equal(f.statut, 'echec');
    assert.match(f.resume, /refusée après quatre essais : nouveau saut interdit/);
    assert.equal(appels(), 1, 'la base est jouée une seule fois (mémorisée)');
  });
});

test('LECTURE TAP : nom, motif et niveau des sauts ; un todo n\'est pas un saut', () => {
  const s = 'ok 1 - a # SKIP motif un\n    ok 1 - sous # SKIP x y\nok 2 - b # SKIP\nok 3 - c # TODO\nok 4 - d\n';
  assert.deepEqual(sautesTap(s), ['0:a # motif un', '1:sous # x y', '0:b #']);
  assert.deepEqual(sautesTap(''), []);
});

// Bac réel simulé : un faux « docker » exécute la commande sur le dossier monté, comme le vrai conteneur. La base est FIGÉE avant tout
// travail de l'agent : rendre sauté un test qui passait sur la base est refusé, même si l'agent a modifié la copie de travail.
test('BAC : la base est figée AVANT le travail de l\'agent ; sauts identiques admis, saut provoqué par l\'agent refusé', async () => {
  const d = mkdtempSync(join(tmpdir(), 'bac-sautes-'));
  try {
    const docker = join(d, 'faux-docker');
    writeFileSync(docker, '#!/bin/bash\nwhile [ "$#" -gt 0 ]; do case "$1" in --volume) hote="${2%%:*}"; shift 2;; node:22-*) shift; break;; *) shift;; esac; done\ncd "$hote" && exec "$@"\n');
    chmodSync(docker, 0o755);
    const racine = join(d, 'depot');
    mkdirSync(join(racine, 'tests'), { recursive: true });
    mkdirSync(join(racine, 'app'), { recursive: true });
    writeFileSync(join(racine, 'app', 'a.js'), 'export const a = 1;\n');
    const fichier = (sauteB) => `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('nav', { skip: ${JSON.stringify(MOTIF)} }, () => {});\ntest('b', ${sauteB ? `{ skip: ${JSON.stringify(MOTIF)} }, ` : ''}() => { assert.equal(1, 1); });\n`;
    writeFileSync(join(racine, 'tests', 'a.test.mjs'), fichier(false));
    const ok = outilsEtape({ etape: 'developper', racine, autorises: ['app/a.js'], docker });
    assert.match((await ok.executer('ecrire', { chemin: 'app/a.js', contenu: 'export const a = 2;\n' })).texte, /écrit/);
    const f = (await ok.executer('terminer', { statut: 'candidat', resume: 'r' })).fin;
    assert.deepEqual(f.tests, { total: 2, reussis: 1, echecs: 0, sautes: 1 });
    // L'agent (périmètre élargi pour l'épreuve) rend sauté le test « b » : la base figée le jouait, le saut est refusé.
    const triche = outilsEtape({ etape: 'developper', racine, autorises: ['tests/a.test.mjs'], docker });
    assert.match((await triche.executer('ecrire', { chemin: 'tests/a.test.mjs', contenu: fichier(true) })).texte, /écrit/);
    assert.match((await triche.executer('terminer', { statut: 'candidat', resume: 'r' })).erreur, /nouveau saut interdit[^]*b # Playwright absent/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
