// v0.66.9 — ATELIER 2, L4 : garde de l'atelier autonome sur le BRANCHEMENT de la porte d'essai (app/main.js, app/index.html) et sur les accès
// aux essais hors de la porte. Mêmes cas que le contrat du robot (tests/atelier-classification) : l'Atelier ne débranche ni ne contourne la
// porte qui coupe ses capacités. Outillage non cognitif.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as N from '../outils-atelier/auto-autonome-noyau.mjs';

const MAIN = readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
const INDEX = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const modif = (chemin, avant, apres) => ({ chemin, etat: 'modifie', avant, apres });
const objections = (f) => N.gardesStatiques([f], { version: '0.66.9' }).objections.join(' | ');

test('branchement : les fichiers actuels portent les quatre blocs balisés', () => {
  for (const nom of ['PORTE', 'DEMARRAGE']) assert.equal(MAIN.split(`=== DEBUT_BRANCHEMENT_ESSAIS_${nom} ===`).length, 2);
  for (const nom of ['BOUTON', 'ECRAN']) assert.equal(INDEX.split(`=== DEBUT_BRANCHEMENT_ESSAIS_${nom} ===`).length, 2);
  assert.deepEqual(N.gardeBranchementEssais(modif('app/main.js', MAIN, MAIN)), []);
  assert.deepEqual(N.gardeBranchementEssais(modif('app/index.html', INDEX, INDEX)), []);
});

test('branchement : un changement ordinaire de main.js ou index.html, hors des blocs, passe la garde', () => {
  assert.equal(objections(modif('app/main.js', MAIN, `${MAIN}\nconst salutation = 'bonjour';\n`)), '');
  assert.equal(objections(modif('app/index.html', INDEX, INDEX.replace('</body>', '<p>pied</p>\n</body>'))), '');
});

test('branchement : contre-épreuves (bloc modifié, bloc retiré, balise orpheline, ligne essai hors bloc, fichier supprimé)', () => {
  const ouverture = '// === DEBUT_BRANCHEMENT_ESSAIS_PORTE ===\n';
  const cas = [
    [modif('app/main.js', MAIN, MAIN.replace(ouverture, `${ouverture}porteEssais = null;\n`)), /bloc BRANCHEMENT_ESSAIS_PORTE modifié/],
    [modif('app/main.js', MAIN, MAIN.replace(/^[ \t]*\/\/ === DEBUT_BRANCHEMENT_ESSAIS_DEMARRAGE ===\n[\s\S]*?\/\/ === FIN_BRANCHEMENT_ESSAIS_DEMARRAGE ===\n/m, '')), /BRANCHEMENT_ESSAIS_DEMARRAGE modifié/],
    [modif('app/main.js', MAIN, MAIN.replace('// === FIN_BRANCHEMENT_ESSAIS_PORTE ===', '// fin')), /orpheline/],
    [modif('app/main.js', MAIN, `${MAIN}\nconst essaiCache = true;\n`), /hors des blocs/],
    [modif('app/main.js', MAIN, MAIN.replace(/^.*TABLES_ESSAIS.*connaissances.*$/m, '')), /hors des blocs/],
    [modif('app/index.html', INDEX, INDEX.replace(/<!-- === DEBUT_BRANCHEMENT_ESSAIS_BOUTON === -->\n/, '')), /orpheline/],
    [{ chemin: 'app/main.js', etat: 'supprime', avant: MAIN, apres: null }, /branchement de la porte d'essai perdu/],
  ];
  for (const [f, re] of cas) assert.match(objections(f), re);
});

test('accès aux essais hors de la porte : base de la zone, registre, chemins, catalogue livré → objection', () => {
  const av = 'export const x = 1;\n';
  for (const ajout of ["indexedDB.open('naissance-essais');", "localStorage.getItem('naissance-ia.essais.registre.v1');", "import('./essais/porte.js');",
    "import { x } from '../essais/registre-essais.js';", "const d = 'essais';", "fetch('capacites-essai/catalogue.json');"]) {
    assert.match(objections({ chemin: 'app/vue/autre.js', etat: 'cree', avant: null, apres: `${av}${ajout}\n` }), /accès aux essais ajouté hors de la porte/, ajout);
  }
  // une référence DÉJÀ présente n'est pas un ajout ; app/capacites-essai/ est la place des capacités livrées
  const t = `${av}const d = 'essais';\n`;
  assert.deepEqual(N.gardeBranchementEssais(modif('app/vue/autre.js', t, `${t}const y = 2;\n`)), []);
  assert.deepEqual(N.gardeBranchementEssais({ chemin: 'app/capacites-essai/compte.js', etat: 'cree', avant: null, apres: "export function executer() { return 'essais'; }\n" }), []);
  // app/essais/ reste refusé comme chemin protégé
  assert.match(objections({ chemin: 'app/essais/porte.js', etat: 'modifie', avant: av, apres: `${av}//\n` }), /protégé/);
});

test('transition : sans blocs balisés dans la base, aucune garde de branchement (même règle que le robot)', () => {
  const sans = 'import x from "./a.js";\nconst essai = 1;\n';
  assert.deepEqual(N.gardeBranchementEssais(modif('app/main.js', sans, `${sans}const essai2 = 2;\n`)), []);
});
